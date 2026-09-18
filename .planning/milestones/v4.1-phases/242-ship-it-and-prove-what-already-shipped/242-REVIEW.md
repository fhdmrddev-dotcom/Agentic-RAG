---
phase: 242-ship-it-and-prove-what-already-shipped
reviewed: 2026-09-11T09:35:00Z
depth: deep
files_reviewed: 15
files_reviewed_list:
  - frontend/src/pages/SettingsPage.tsx
  - frontend/src/pages/SettingsPage.test.tsx
  - frontend/src/pages/__tests__/SettingsPage.a11y.test.tsx
  - frontend/src/pages/__tests__/SettingsPage.changedFields.test.tsx
  - backend/app/api/settings.py
  - backend/tests/unit/test_242_settings_bounds_have_schema_constraints.py
  - backend/tests/unit/test_242_stored_value_refusal.py
  - supabase/migrations/178_app_settings_vision_calls_bound.sql
  - supabase/full-schema.sql
  - scripts/apply_migration_178.py
  - scripts/verify-v40-cloud-migrations.sql
  - scripts/check-hot-file-ledger.cjs
  - scripts/vitest-count-gate.cjs
  - CLAUDE.md
  - docs/HOT-FILE-LEDGER.md
findings:
  critical: 0
  warning: 10
  info: 9
  total: 19
status: issues_found
---

# Phase 242: Code Review Report

**Reviewed:** 2026-09-11T09:35:00Z
**Depth:** deep
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Fifteen source files across four surfaces: a frontend payload diff, a backend refusal helper, a
schema migration plus its apply harness, a cloud verifier, and two gate scripts. Everything was
**driven rather than read where driving was possible** — the three adopted vitest suites, the two new
pytest files, a direct `await update_settings(...)` against both refusal branches, an app-config
typecheck set-diff against the phase's own base file, `eslint` against the changed file *and* against
the base version of the same file, and the hot-file ledger gate against two synthetic phase
directories.

**Answers to the five questions asked, in order:**

1. **The silent drop — NOT PRESENT.** All 24 Search-tab keys in `searchPayloadFrom`
   (`SettingsPage.tsx:595-624`) were compared by hand, expression for expression, against what
   `hydrate` (`:825-871`) actually sets into state. **All 24 mirror.** The two `KEY_PLACEHOLDER`
   constants are correct on both sides (the state after `hydrate` is either `"***"` or `""`, and
   `"" || KEY_PLACEHOLDER` collapses to `"***"`, which `save_app_settings` skips —
   `user_settings.py:542`). The `??` fallbacks (`vision_model`, `vision_max_pages`,
   `hnsw_ef_search`, `hnsw_iterative_scan`) and the `||` fallbacks (`embedding_provider`,
   `extraction_provider`, `extraction_model`) are reproduced identically, including the
   `EXTRACTION_PRESETS.find` lookup. `onlyChanged` iterating `next` rather than `baseline` is the
   correct (fail-safe) direction and is fenced. **However, the fence that is supposed to *prove*
   this is weaker than its own docstring claims — see WR-01, which is the highest-value finding in
   this review.**
2. **`_range_refusal_detail` cannot turn a 400 into a 500 — MEASURED, not reasoned.** `await` in
   `raise HTTPException(detail=await ...)` argument position is ordinary Python: the coroutine is
   awaited while building the call, then the exception is constructed and raised. Driven directly
   against `update_settings` with `load_app_settings_async` patched (a) to return `stored == submitted`
   and (b) to `raise RuntimeError`. Both produced **`400`**, (a) with the new sentence and (b) with
   the typed sentence byte-for-byte. The `hnsw_ef_search` site was driven separately (both arms) and
   also returns 400. Residual issues are WR-04/WR-05, not a status-code bug.
3. **The migration is correct on order, re-runnability and the paste path.** The clamps
   (`:77-85`) genuinely precede the `ADD CONSTRAINT`s (`:88-102`); `DROP CONSTRAINT IF EXISTS`
   precedes every `ADD`; `NULL` stays legal on both. `BEGIN;`/`COMMIT;` at top level is **not** the
   105/107 failure mode — that was `COMMIT` inside a `PROCEDURE`/`DO` body. 28 migrations in this
   repo already ship top-level `BEGIN;`/`COMMIT;`, including 154/155/156 which were pasted into the
   SQL editor. The one real concern is that the clamp is **silent** (WR-08), and one accuracy nit
   (IN-03).
4. **The apply script cannot leave the local database modified by a partial failure.** Traced every
   arm: the two applies commit deliberately (that is the point); both positive controls are
   rollback-protected, and the outer `finally: conn.close()` rolls back any open transaction if an
   arm raises mid-way. The genuinely fragile line is `:179` (WR-07), which is currently safe and one
   edit away from committing a destructive plant.
5. **Two test defects found** — WR-01 (the fixture pair cannot catch a hard-coded baseline for 9 of
   24 keys, including `retrieval_match_threshold`, which is the single most likely edit target on
   the tab) and WR-10 (`§7` re-implements the production expression instead of calling it).

**Gates measured green during this review, not taken on trust:**
`SettingsPage.changedFields.test.tsx` 17/17 · `a11y` 4/4 · `sourceCeiling` 9/9 · `SettingsPage.test.tsx`
24/24 (37 total across the three adopted suites — exactly the three new BASELINE pins) ·
`test_242_*` 29 passed · `tsc -p tsconfig.app.json --noEmit` **67 errors, set-identical to
`242-tsc-base.txt` modulo the +107-line shift** · `check-claude-md-size.cjs` OK (91,301 chars) ·
`check-hot-file-ledger.cjs 242` OK · both ledger triples re-derived and **correct**
(`settings.py` 37/…/933, `SettingsPage.tsx` 46/…/1858).

**No BLOCKER-class defect was found.** That is stated as a measurement, not as a compliment: the
24-key mirror was checked key by key, the 400/500 question was driven at two sites, and the apply
script's rollback arms were traced individually. The ten warnings below are all real and all have
one-line-to-one-file fixes.

## Warnings

### WR-01: The `§1` fixture pair cannot catch a hard-coded baseline for 9 of the 24 keys — including the likeliest edit on the tab

**File:** `frontend/src/pages/__tests__/SettingsPage.changedFields.test.tsx:17-22, 114-146, 272-292`

**Issue:** The file's headline claim is that `NON_DEFAULT` is *"the fixture that separates 'mirrors
hydrate' from 'returns the constants hydrate's fallbacks happen to produce'"*, and `§1 FIXTURE B` is
labelled *"a baseline of hard-coded constants CANNOT pass this."* **That is true for 15 of the 24
keys and false for the other 9.** For a key to be caught, its fixture value must differ from the
corresponding `useState` initial value in `SettingsPage.tsx:713-768`. Checked one by one, these nine
are **identical in both fixtures**:

| key | `mkSettings` value | `useState` initial | `NON_DEFAULT` override |
|---|---|---|---|
| `embedding_base_url` | `""` | `useState("")` | none |
| `rerank_enabled` | `false` | `useState(false)` | none |
| `rerank_provider` | `"api"` | `useState("api")` | none |
| `rerank_model` | `""` | `useState("")` | none |
| `rerank_top_n` | `5` | `useState(5)` | none |
| `retrieval_match_threshold` | `0.3` | `useState(0.3)` | none |
| `hybrid_search_enabled` | `true` | `useState(true)` | none |
| `vector_search_weight` | `1` | `useState(1.0)` | none |
| `keyword_search_weight` | `1` | `useState(1.0)` | none |

Writing `retrieval_match_threshold: 0.3` as a **constant** in `searchPayloadFrom` — exactly the
mistake the file's own `⚠⚠` block describes for `hnsw_ef_search` — is green against **both** §1
fixtures, §2, §2b, §3, §4 and §5. In production that is a silent drop on the field an operator is
most likely to move, and `0.3` is its most likely destination value: an install storing `0.5` whose
operator drags the threshold to `0.3` would see "Saved" and keep `0.5`.

The current implementation is correct — I verified all 24 by hand. This is a fence gap, not a live
defect, but the fence is the *only* thing standing between this code and the failure class the phase
named as its most dangerous.

**Fix:** give every one of the nine a distinctive value in `NON_DEFAULT`, so the fixture genuinely
carries the property it claims:

```ts
const NON_DEFAULT = () =>
  mkSettings({
    // … existing 11 overrides …
    // ⚠ THE NINE THAT WERE INVISIBLE: each of these matched its own `useState` initial value in
    //    BOTH fixtures, so a hard-coded baseline for any of them passed §1 twice.
    embedding_base_url: "https://embed.example.invalid/v1",
    rerank_enabled: true,
    rerank_provider: "local",
    rerank_model: "rerank-v3.5",
    rerank_top_n: 9,
    retrieval_match_threshold: 0.55,
    hybrid_search_enabled: false,
    vector_search_weight: 2.5,
    keyword_search_weight: 0.4,
  })
```

Note `hybrid_search_enabled: false` hides the `hybridCandidates` / weights / `rrf_k` FieldRows
(`SettingsPage.tsx:1647-1661` renders them inside the hybrid block), so either keep it `true` and
cover it in a third fixture, or assert `{}` with the block collapsed — which is itself a case worth
having, since a collapsed control still rides the payload.

---

### WR-02: The 24-key mirror is hand-duplicated with nothing structurally coupling the two lists

**File:** `frontend/src/pages/SettingsPage.tsx:595-624` (baseline) vs `:825-871` (hydrate) vs `:973-1001` (payload)

**Issue:** Three hand-maintained lists of the same 24 fields now have to stay in lockstep, and
TypeScript cannot help: every field on `SettingsUpdate` is optional
(`frontend/src/lib/api/skills.ts:680-739`), so omitting a key, adding a key, or writing the *wrong
expression* for a key are all type-clean. The docstring at `:588` says so honestly (*"THIS MUST
MIRROR `hydrate` EXACTLY, expression for expression"*) and hands the entire guarantee to two test
fixtures — which WR-01 shows are not sufficient. Every future edit to the Search tab must remember to
touch three places; the phase's own hot-file row notes this handler is already *"a 500-line linear
wall"* on the backend side, and this is the frontend analogue.

**Fix:** make drift structurally impossible by having `hydrate` set the state **from** the same
builder the baseline uses, so there is one list instead of two:

```ts
const hydrate = (data: FullAppSettings) => {
  // … non-Search state …
  const search = searchPayloadFrom(data)          // ONE expression set, used twice
  setEmbeddingModel(search.embedding_model!)
  setEmbeddingBaseUrl(search.embedding_base_url!)
  setEmbeddingDimensions(search.embedding_dimensions!)
  setEmbeddingApiKey(data.embedding_has_api_key ? KEY_PLACEHOLDER : "")  // the ONE honest exception
  // … the remaining 20, each read off `search` …
  setSearchBaseline(search)
}
```

Only the two API-key fields legitimately differ between "what the field shows" and "what the baseline
holds"; keeping those two explicit and driving the other 22 off `search` removes 22 opportunities for
the exact bug the phase is fencing against.

---

### WR-03: Exporting the two helpers from `SettingsPage.tsx` breaks Fast Refresh for the whole page — two NEW eslint errors on a file that was clean

**File:** `frontend/src/pages/SettingsPage.tsx:595`, `:639`

**Issue:** Measured, not inferred. At HEAD:

```
src/pages/SettingsPage.tsx
  595:17  error  Fast refresh only works when a file only exports components…  react-refresh/only-export-components
  639:17  error  Fast refresh only works when a file only exports components…  react-refresh/only-export-components
✖ 2 problems (2 errors, 0 warnings)
```

The same lint run against the file's content at the phase base commit (`7ac71638e`, checked out to a
scratch path and linted) reports **zero problems**. Both errors are introduced by this change. The
consequence is concrete: every edit to `SettingsPage.tsx` during development now full-reloads the
page instead of hot-swapping, discarding whatever the operator had typed into the Settings form —
on a 1,858-line page whose whole job is a form. `npm run lint` is not gated in CI
(`.github/workflows/frontend-tests.yml:44-57` gates only `lint:a11y`), so nothing caught it.

**Fix:** move both pure functions to a sibling module. Nothing about the tests gets harder — they
already import them by name.

```ts
// frontend/src/pages/settingsSearchPayload.ts
import type { FullAppSettings, SettingsUpdate } from "@/lib/api"
export function searchPayloadFrom(data: FullAppSettings): SettingsUpdate { /* moved verbatim */ }
export function onlyChanged(next: SettingsUpdate, baseline: SettingsUpdate): SettingsUpdate { /* moved verbatim */ }
```

then in `SettingsPage.tsx`: `import { searchPayloadFrom, onlyChanged } from "./settingsSearchPayload"`,
and in `SettingsPage.changedFields.test.tsx:60` split the import accordingly. `KEY_PLACEHOLDER` and
`EXTRACTION_PRESETS` move or get re-exported with it. A pure-logic module is also the natural home
for the fence file.

---

### WR-04: `_range_refusal_detail` does an unguarded `getattr` on a secret-bearing settings object and echoes the result into an HTTP response body

**File:** `backend/app/api/settings.py:370-378, 400, 404-409`

**Issue:** The helper's contract is `field: str` → `getattr(await load_app_settings_async(), field, None)`
→ interpolated verbatim into the 400 body. `UserEffectiveSettings`
(`backend/app/models/user_settings.py:118-165`) holds **decrypted plaintext secrets** —
`llm_api_key`, `embedding_api_key`, `rerank_api_key`, `tavily_api_key` — on the same object. There is
no allow-list and no type constraint beyond `str`.

Today all four call sites (`:512`, `:544`, `:578`, `:677`) pass a literal, so nothing leaks. But the
helper is module-level, generically named, and its docstring advertises reuse (*"⭐ ONE HELPER, FOUR
SITES"*). The next bound that routes a field name through a loop, a dict, or a `body`-derived value
turns this into a credential disclosure with no code review signal — and the caller would look
entirely reasonable. This project has already paid twice for "the value was code-controlled when it
was written" (`save_app_settings`'s `_VALID_COLUMN_NAME` guard at `user_settings.py:536` exists for
exactly this shape).

**Fix:** constrain the helper to the columns it is allowed to read, at the seam rather than at each
caller:

```python
# ⛔ THE HELPER READS AN OBJECT THAT ALSO HOLDS DECRYPTED API KEYS, and interpolates what it reads
#    into an HTTP body. Bound it HERE, not at the call sites — a future caller that passes a
#    non-literal must fail loudly rather than exfiltrate `llm_api_key` in a 400.
_REFUSABLE_FIELDS = frozenset({
    "multimodal_max_vision_calls", "vision_max_pages",
    "source_max_file_size_mb", "hnsw_ef_search",
})

async def _range_refusal_detail(*, field: str, ...) -> str:
    if field not in _REFUSABLE_FIELDS:
        logger.error("refusal helper asked for a non-bounded field: %s", field)
        return typed_detail
    ...
```

A companion case in `test_242_stored_value_refusal.py` — pass `field="llm_api_key"` with a stub
holding `llm_api_key="sk-secret"` and assert the secret is **not** in the returned string — makes the
guard one that has been seen to fire.

---

### WR-05: The fallback swallows the settings-read failure with no log, so the degraded path is invisible

**File:** `backend/app/api/settings.py:399-402`

**Issue:**

```python
try:
    stored = getattr(await load_app_settings_async(), field, None)
except Exception:  # noqa: BLE001 — any read failure falls back; see the docstring
    stored = None
```

The bare fallback is the right *behaviour* (proven at `test_242_stored_value_refusal.py:105-119`,
and re-driven end-to-end during this review: a raising read still yields 400). But it emits nothing.
If `load_app_settings_async` starts failing — the docstring names a pool blip and a connection reset
— the only observable symptom is that operators quietly stop getting the better sentence. In a
codebase whose recurring finding is *"a silent failure is the bug class"* (this very phase fixes one,
and `settings.py:698` already documents `save_app_settings` swallowing a CHECK violation), an
unlogged `except Exception` on a newly-added I/O path is a step backwards.

Separately, the docstring claims *"Every failure falls back to `typed_detail`"*, but the `try` covers
only the read — the `stored == submitted` comparison (`:403`) and the f-string (`:405-409`) sit
outside it. Narrow, but the claim is broader than the code.

**Fix:**

```python
except Exception:  # noqa: BLE001 — any read failure falls back; see the docstring
    logger.warning(
        "refusal helper could not read settings for %s; falling back to the typed sentence",
        field, exc_info=True,
    )
    stored = None
```

and either widen the `try` to cover the comparison + format, or narrow the docstring sentence to
"every failure **of the read**".

---

### WR-06: `check-hot-file-ledger.cjs` still passes vacuously — the CRLF fix closed one input shape and left another open (driven RED)

**File:** `scripts/check-hot-file-ledger.cjs:105-112`, `:161-165`

**Issue:** The new comment states the contract precisely: *"⛔ A GATE THAT PASSES BECAUSE IT PARSED
NOTHING IS WORSE THAN NO GATE: it answers the auditor with 'clear' and stops the audit."* The CRLF
normalisation fixes one way to reach that state. **The state is still reachable, and I reproduced it.**

Two synthetic phase directories, both naming a file with no ledger row:

```
=== CRLF plan (the shape the fix closes) ===
  scan list: 252 rows · subject: 1 files · watched: 1
  G-5 CANNOT FIRE ON 1 FILE(S) …            EXIT=1     ← correct, the fix works

=== flow-style `files_modified: [frontend/src/pages/NoSuchPage.tsx]` ===
  scan list: 252 rows · subject: 0 files · watched: 0
  ledger gate OK — every watched file has a row.   EXIT=0   ← VACUOUS PASS
```

The two `continue`s at `:109` and `:112` still discard an unparseable plan in silence, and `main()`
(`:161-165`) prints `ledger gate OK` for `watched.length === 0` with no floor on the subject side —
even though it *does* enforce `MIN_SCAN_ROWS` on the ledger side (`:139-143`) for precisely this
reason. YAML flow sequences are valid frontmatter and are what most YAML emitters produce.

**Fix:** apply the floor the ledger side already has, and make a skipped plan loud:

```js
for (const p of plans) {
  const text = fs.readFileSync(path.join(dir, p), 'utf8').replace(/\r\n/g, '\n');
  const fm = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!fm) fail(`${p} has no parseable YAML frontmatter — refusing to pass over a plan I cannot read`);
  const block = /files_modified:\s*\n((?:\s*-\s*.+\n)+)/.exec(fm[1] + '\n')
             || /files_modified:\s*\[([^\]]*)\]/.exec(fm[1]);   // flow style
  if (!block) fail(`${p} has no parseable files_modified — see the CRLF note above`);
  …
}
// and in main(), mirroring MIN_SCAN_ROWS:
if (!subject.size) fail('parsed 0 files from the phase plans — a gate that parsed nothing cannot pass');
```

Drive both arms against a synthetic plan the way the CRLF arm was driven, so the new refusal is one
that has been seen to fire.

---

### WR-07: The apply script's destructive NULL plant is protected only by a textual `.replace()` of literals that live in a different file

**File:** `scripts/apply_migration_178.py:179`

**Issue:**

```python
cur.execute("update public.app_settings set multimodal_max_vision_calls = null, vision_max_pages = null")
cur.execute(sql.replace("BEGIN;", "").replace("COMMIT;", ""))
```

The plant is destructive by design and is meant to be rolled back. It is **only** rolled back if the
`COMMIT;` strip matches. `sql` is the verbatim text of `178_app_settings_vision_calls_bound.sql`, and
the strip is a bare literal match: change that file's `COMMIT;` to `COMMIT ;`, `commit;`, `COMMIT
WORK;`, or move it behind a `DO $$` body, and the embedded commit fires **after** the NULL plant. The
operator's `multimodal_max_vision_calls` and `vision_max_pages` are then permanently NULL, and the
`finally: conn.rollback()` at `:192` rolls back nothing.

It is currently safe — the file contains exactly one `BEGIN;` and one `COMMIT;` and I confirmed no
other occurrence, including in the header and VERIFY comment blocks. The script's final
`final != after2` check at `:197` would *detect* the loss and print `*** POSITIVE CONTROLS FAILED ***`
— but detection is not repair, and NULL means "fall back to the `config.py` default", so the operator
silently loses whatever they had configured. This is one careless edit of an adjacent file away from
being a data-loss BLOCKER, in a script whose stated purpose is to prove nothing was lost.

**Fix:** stop depending on the strip. Use a SAVEPOINT, which is immune to an embedded `COMMIT`… or,
simpler and stronger, assert the strip actually removed something before running anything
destructive:

```python
stripped = sql.replace("BEGIN;", "").replace("COMMIT;", "")
if "COMMIT" in stripped.upper().replace("-- ", ""):
    print("FATAL: the COMMIT strip did not match — refusing to run a destructive plant that "
          "would then be COMMITTED rather than rolled back")
    return 2
```

and put the whole NULL arm's plant + re-apply behind `cur.execute("SAVEPOINT null_probe")` /
`ROLLBACK TO SAVEPOINT null_probe` so the blast radius does not depend on string matching at all.

---

### WR-08: Migration 178 repairs a silent value silently — the clamp announces nothing on the mandated paste path

**File:** `supabase/migrations/178_app_settings_vision_calls_bound.sql:77-85`

**Issue:** The migration's own header explains the bug class perfectly: a stored `1001` nobody typed,
changing behaviour with nothing announcing it. The remedy then **overwrites that value with no
record**. `UPDATE … SET col = least(greatest(col, 1), 1000)` emits no output, the original is not
preserved anywhere, and CLAUDE.md's mandated apply path is *"paste into the Supabase SQL editor"* —
where the operator sees `UPDATE 1` at most, with no indication of what changed from what. The header
says *"we can repair correctly and announce in the phase record"*, but the phase record is not in the
SQL editor, and the next environment this file lands in (cloud, a restored dump, a contributor's box)
will not have the phase record open.

The VERIFY block at `:124-142` confirms values are *now* in range; it cannot say whether any value
*moved*, or from what.

**Fix:** make the repair legible where it happens, without changing its semantics:

```sql
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT multimodal_max_vision_calls AS calls, vision_max_pages AS pages
      FROM public.app_settings
     WHERE (multimodal_max_vision_calls IS NOT NULL
            AND (multimodal_max_vision_calls < 1 OR multimodal_max_vision_calls > 1000))
        OR (vision_max_pages IS NOT NULL
            AND (vision_max_pages < 1 OR vision_max_pages > 500))
  LOOP
    RAISE NOTICE 'migration 178 is CLAMPING an out-of-range stored value: '
                 'multimodal_max_vision_calls=% vision_max_pages=% — record this before proceeding',
                 r.calls, r.pages;
  END LOOP;
END $$;
```

placed immediately before the two `UPDATE`s. `RAISE NOTICE` inside a `DO` block is safe in the SQL
editor — the 105/107 problem was `COMMIT` inside a procedural body, not `RAISE`. A `RETURNING` clause
on each `UPDATE` is the smaller alternative and prints the new value only.

---

### WR-09: The rewritten cloud verifier claims full parity while having no row for migration 177 — the security migration

**File:** `scripts/verify-v40-cloud-migrations.sql:33-35`, and the row list (`:38-145`)

**Issue:** The header now reads: *"Expected now, on any database that has had the full v4.0 set
applied: EVERY row PASS. A `*** FAIL ***` means that migration genuinely has not landed."* The rows
cover `153` through `176`. There is **no row for `177_rls_app_settings_user_settings.sql`** — the
BUG-260911-01 fix that enables RLS on `app_settings` / `user_settings` and revokes the `anon` grants
that made `/rest/v1/app_settings` world-writable in production — and none for `178`.

That omission reproduces the exact blind spot 177 was written to close. 177's own header says it
best: *"EVERY GATE STAYED GREEN … No unit test, typecheck, count gate or deploy check makes a request
as `anon`."* The one artifact that *could* check it is this file; the phase edited this file the
following day and did not add the row. An operator running it and seeing all-PASS would reasonably
conclude parity while `app_settings` RLS could be off or the `PUBLIC` function grants could be back
(CLAUDE.md records that `REVOKE … FROM anon` is a no-op while the `PUBLIC` grant stands).

For `178` the situation is different but also unhandled: it is deliberately not applied to cloud, and
the phase correctly *retired* the "assert absence" pattern for `176` rather than repeating it — but
then recorded 178's cloud debt in prose only, which is the register this project's own seeds rule
calls *"a deferral with no re-open, which is a deletion that looks like a decision."*

**Fix:** add the 177 rows (they are pure reads and need no approval), and give 178 an honest,
non-inverting row:

```sql
  ('177', 'app_settings has RLS ENABLED',
   (select relrowsecurity from pg_class where oid='public.app_settings'::regclass)),
  ('177', 'user_settings has RLS ENABLED',
   (select relrowsecurity from pg_class where oid='public.user_settings'::regclass)),
  ('177', 'anon cannot SELECT app_settings',
   not has_table_privilege('anon','public.app_settings','SELECT')),
  ('177', 'anon cannot UPDATE or DELETE app_settings',
   not (has_table_privilege('anon','public.app_settings','UPDATE')
        or has_table_privilege('anon','public.app_settings','DELETE'))),

  -- ⚠ 178 is DELIBERATELY not on cloud yet (Phase 242). This row is INFORMATIONAL and its
  --    polarity is PRESENCE, like every other row — it will read FAIL until 178 is applied,
  --    and that FAIL is the reminder, not a defect. Do NOT invert it: inverting is what made
  --    the 176 row report FAIL for the success case for a day.
  ('178', 'app_settings_multimodal_max_vision_calls_bound present (owed to cloud, Phase 242)',
   exists(select 1 from pg_constraint
          where conname='app_settings_multimodal_max_vision_calls_bound')),
```

Also worth pairing with the CLAUDE.md deploy-parity checklist item to run
`get_advisors(security)` — the advisor is what found 177 in the first place, and it catches classes
this hand-written row list cannot.

---

### WR-10: `§7` re-implements the production expression instead of exercising it, so it cannot fail when the production expression changes

**File:** `frontend/src/pages/__tests__/SettingsPage.changedFields.test.tsx:404-416`

**Issue:**

```ts
const full = searchPayloadFrom(NON_DEFAULT())
const baseline: SettingsUpdate | null = null
const body = baseline ? onlyChanged(full, baseline) : full
expect(Object.keys(body).length).toBe(24)
```

`baseline` is a `null` literal that TypeScript narrows, so the ternary is resolved at authoring time
and the test is asserting `full === full`. It is a **copy** of `SettingsPage.tsx:1008`, not a use of
it. Change the production line to `searchBaseline ? onlyChanged(full, searchBaseline) : {}` — which
is the plausible "tidy-up" that reintroduces the collapse-unknown-into-nothing bug the case exists to
prevent — and this test stays green. The comment justifies driving it as a unit because the page's
error branch hides the Save button; that reasoning is sound, but the conclusion drawn from it is a
test that cannot observe the code.

The `Object.keys(body).length === 24` assertion *is* worth keeping — it is a genuine count fence over
`searchPayloadFrom`.

**Fix:** either drive the real page with a baseline that is genuinely `null` at save time, or split
the property out of the component so it can be called:

```ts
// SettingsPage.tsx — the expression becomes nameable and testable
export function searchBodyFor(full: SettingsUpdate, baseline: SettingsUpdate | null): SettingsUpdate {
  return baseline ? onlyChanged(full, baseline) : full   // ⛔ never `{}` — an unknown baseline is not "unchanged"
}
```

```ts
// the test then exercises the shipped expression rather than a copy of it
expect(Object.keys(searchBodyFor(full, null))).toHaveLength(24)
expect(searchBodyFor(full, null)).toEqual(full)
```

(If WR-03 is taken, `searchBodyFor` lands in the same new module and the export costs nothing.)

## Info

### IN-01: The `hnsw_ef_search` typed sentence was left under-indented relative to the other three sites

**File:** `backend/app/api/settings.py:684-694`

**Issue:** The other three call sites indent the `typed_detail=(` continuation to 24 columns; this one
kept the pre-refactor indentation, so the f-string fragments sit at the same level as the
`typed_detail=(` keyword itself. Functionally irrelevant (implicit string concatenation), visually it
reads as if the parenthesis closed early.

**Fix:** re-indent lines 684-694 by four spaces to match `:519-522`, `:551-554`, `:585-594`.

---

### IN-02: Migration 178's `COMMENT ON COLUMN vision_max_pages` drops the observable-artifact documentation the previous comment carried

**File:** `supabase/migrations/178_app_settings_vision_calls_bound.sql:112-117`; visible in `supabase/full-schema.sql:767`

**Issue:** The prior comment named where a truncation is *recorded*:
*"the shortfall is recorded in `documents.metadata._vision.truncated` AND stated in every chunk
header, so a partial transcription can never read as complete."* The replacement documents the bound
and drops that pointer. Since `COMMENT ON COLUMN` replaces rather than appends, the only record of
where a truncation surfaces is now in code.

**Fix:** append the dropped sentence to 178's comment text so the regenerated `full-schema.sql`
carries both facts.

---

### IN-03: "the shape migrations 174 and 176 already established" is not accurate about `BEGIN;`/`COMMIT;`, and the apply script does not actually prove that boundary

**File:** `supabase/migrations/178_app_settings_vision_calls_bound.sql:22, 74, 119`; `scripts/apply_migration_178.py:71, 82`

**Issue:** Two small things, both harmless today. (a) `174_app_settings_source_max_file_size.sql` and
`176_app_settings_hnsw_knobs.sql` — the two files 178 says it copies — contain **no** `BEGIN;`/`COMMIT;`.
28 other migrations do, so the convention is real, but the cited precedent is not the one that
establishes it. (b) `psycopg2` opens an implicit transaction on the first statement, so when the
script runs `cur.execute(sql)` the migration's `BEGIN;` emits `WARNING: there is already a transaction
in progress` and is ignored, while its `COMMIT;` commits the transaction that the preceding `_snapshot`
SELECT opened. The net effect is identical, but **the script does not exercise the migration's own
transaction boundary** — so its "re-runnable / nothing lost" proof says nothing about the SQL-editor
paste path, which is the one CLAUDE.md mandates.

**Fix:** cite the actual precedent (154/155/156), and set `conn.autocommit = True` before the two
applies so the file's own `BEGIN;`/`COMMIT;` are the transaction under test rather than decoration.

---

### IN-04: Hard-coded database credentials in a committed script

**File:** `scripts/apply_migration_178.py:25`

**Issue:** `DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"`. These are the published
local Supabase defaults, the hard-coding is deliberate and documented (`:10-12` — it is what makes
the script unable to reach cloud by accident), and `apply_migration_075.py` is the stated precedent.
Recorded because a secret-scanning pattern will flag it and someone will have to re-derive that it is
intentional.

**Fix:** none required. A one-line `# nosec / not-a-secret: published local Supabase default, see
supabase/SETUP.md` above the constant would stop the re-derivation cost.

---

### IN-05: The clamp positive control lacks the `try/finally` its sibling arm has, and both plants are unqualified `UPDATE`s

**File:** `scripts/apply_migration_178.py:134-163`

**Issue:** The NULL arm (`:170-192`) wraps its plant in `try/except/finally: conn.rollback()`. The
clamp arm does not — it relies on the outer `finally: conn.close()`, which does roll back, so the
database is safe either way. But the two arms doing the same dangerous thing two different ways is
how the safe one gets copied from the unsafe one. Separately, `:140` and `:152` are
`UPDATE public.app_settings SET … ` with **no `WHERE`**, and `:162-163` assert `== [(1000,)]` /
`== [(1,)]`, so the control silently assumes exactly one row.

**Fix:** wrap `:135-160` in the same `try/finally: conn.rollback()`, and assert
`len(planted) == before['rows']` rather than hard-coding a single-row expectation.

---

### IN-06: `_range_refusal_detail`'s numeric parameters are untyped

**File:** `backend/app/api/settings.py:374-376`

**Issue:** `submitted`, `lo`, `hi` carry no annotation while `field`, `label`, `typed_detail` and the
return are annotated. The module is otherwise fully typed.

**Fix:** `submitted: int | float, lo: int | float, hi: int | float`.

---

### IN-07: A no-op `{}` save still writes a `settings.update` audit row with an empty payload

**File:** `backend/app/api/settings.py:791-798`

**Issue:** `{}` is now the most common Search-tab request shape (the phase's own test class says so
at `test_242_stored_value_refusal.py:190-197`). `save_app_settings({})` correctly returns `True`
without writing, but the audit background task still fires with `metadata={"new_settings": {}}`. The
two-ledger audit browser (Phase 146-148) will accumulate rows recording that nothing happened, which
dilutes the *"✎ writes"* receipt vocabulary that surface is built on.

**Fix:** skip the audit task when there is nothing to audit:

```python
if updates:
    background_tasks.add_task(write_audit_entry, …)
```

---

### IN-08: The accessibility defect the phase discovered is recorded only in a SUMMARY — no test, no lint, no seed, no bug report can see it

**File:** `frontend/src/pages/__tests__/SettingsPage.changedFields.test.tsx:165-181`; the defect is at `frontend/src/pages/SettingsPage.tsx:98-105`

**Issue:** The `fieldInput()` helper exists because `FieldRow` renders a bare `<Label>` with no
`htmlFor` and no `aria-labelledby`, so `getByLabelText("RRF-K constant")` throws *"no form control was
found associated to that label"*. That is a real WCAG 1.3.1 / 4.1.2 failure affecting roughly ten
Search-tab controls, and a screen reader announces those inputs unlabelled. The comment says it *"is
recorded in the phase SUMMARY rather than silently worked around here"* — correct in spirit, but the
SUMMARY is not a register anything sweeps. I confirmed the gate cannot see it either:
`npm run lint:a11y` reports 17 errors at HEAD and **none is in `SettingsPage.tsx`** (the plugin cannot
resolve the shadcn `<Label>` wrapper). So the only trace is a helper's docstring.

**Fix:** plant it as `SEED-NNN` with `relates_to: frontend/src/pages/SettingsPage.tsx` and a
`trigger_when` of *"the next phase whose files_modified names SettingsPage.tsx"*, per CLAUDE.md's
seeds rule. The code fix is small enough to be a `/gsd:fast` candidate:

```tsx
function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  const id = useId()
  return (
    <div className="…">
      <Label htmlFor={id}>{label}</Label>
      {/* the single child input receives the id */}
      {cloneElement(Children.only(children as ReactElement), { id })}
    </div>
  )
}
```

which would also let `SettingsPage.changedFields.test.tsx` delete `fieldInput()` and use
`getByLabelText`, removing its dependence on `parentElement.querySelector("input")`.

---

### IN-09: `has_column_privilege('authenticated', …)` aborts the whole verifier on a database without that role

**File:** `scripts/verify-v40-cloud-migrations.sql:87-90`

**Issue:** The corroborating row is a good addition and the `attacl` parse above it is correct
(`split_part(acl::text,'=',1)` yields the grantee, and PUBLIC's empty grantee correctly does not
match). But `has_column_privilege` raises `ERROR: role "authenticated" does not exist` rather than
returning false, and because all rows live in one `VALUES` list, that error takes down the **entire**
report — every other migration check included. Only relevant on a non-Supabase Postgres, but the
failure mode is "no output at all", which reads as a broken script rather than a missing role.

**Fix:** guard it — `(exists(select 1 from pg_roles where rolname='authenticated')
and has_column_privilege('authenticated', …))`.

---

_Reviewed: 2026-09-11T09:35:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
