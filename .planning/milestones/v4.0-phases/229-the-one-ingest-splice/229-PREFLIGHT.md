---
phase: 229-the-one-ingest-splice
type: preflight
author: Claude (reviewer)
builder: Gemini
date: 2026-09-05
plans_reviewed: [229-01, 229-02, 229-03, 229-04]
also_read: [229-CONTEXT.md, 229-DISCUSSION-LOG.md, 229-SEAM-AUDIT.md, 229-VALIDATION.md]
verdict: execute — 7 gaps to close DURING execution, 2 BLOCKING
---

# Phase 229 — Pre-flight

A gap pass, not a re-plan. Everything closes **inside the existing four plans**.

⭐ **The seam audit is materially better than Phase 228's.** It carries a *Mechanical Field Derivation*
table over eight fields with producer, normalisation, consumers and guarded failure mode on each — which
is exactly what BUS-106 asked for and what the Phase 214 post-mortem says Check-1 alone cannot deliver.
It also picked up the BUS-106 duplicate-attachment inference and made it a named failure mode rather
than a footnote. Both blocking findings below are refinements of that work, not corrections of its shape.

---

## 1. Verified correct — do NOT re-check these during execution

| # | Claim | Evidence |
|---|---|---|
| V-1 | `mint_document_row`'s spec reproduces today's `/upload` behaviour | Diffed against `documents.py:600-690`: `status='pending'` ✅ · dedupe folder-scoped via `.eq("folder_id")` / `.is_("folder_id","null")` ✅ · versioning **user-scoped** on `(user_id, filename)` with the `is_latest=False` cascade ✅ (today's code carries the explicit comment *"user-scoped, not folder-scoped"*) · `storage_path = f"{user_id}/{document_id}/{filename}"` → `file_path` ✅ · `23505` → 409 ✅ (Phase 078 D-078-04). |
| V-2 | Every column the plans write exists — **no migration needed** | `documents` columns measured live: `metadata`, `ingestion_step`, `error_message`, `content_hash`, `file_path`, `version_number`, `is_latest`, `folder_id`, `org_id` all present. |
| V-3 | The BUS-106 duplicate-attachment inference is **CONFIRMED**, not merely plausible | `documents_dedup_idx` measured: `UNIQUE (user_id, content_hash, COALESCE(folder_id, '00000000-0000-0000-0000-000000000000')) WHERE status <> 'failed'`. Two attachments with identical bytes and `folder_id IS NULL` collide by construction. |
| V-4 | The `/upload` HTTP contract is preserved | `229-02` pins 200-on-duplicate / 201-on-new explicitly (`:124`, `:145`, `:157`). |
| V-5 | `import_connection_file` is genuinely broken today | Driven pre-planning (BUS-106): `PGRST204 — "Could not find the 'storage_path' column"`. PostgREST rejects at the first unknown key, so the `NOT NULL file_path` violation is never reached, and `aexec` raising means the background pipeline never runs. **SC#1 is a real user-visible fix.** |

---

## 2. Gaps to close during execution

### ⛔ G-1 (BLOCKING) — D-17's org-shared widening breaks SC#4, and its predicate contradicts the product's own

`229-01` Task 1 specifies folder validation as *"if `user_id != caller` **and not `is_org_shared`**, raise 403"*.
Today (`documents.py:610-617`) the check is `user_id != caller → 403`, full stop. Two separate problems:

**(a) It is a behaviour change on the upload path, which this phase forbids in terms.** Today, uploading
into an org-shared folder you do not own returns **403**; under D-17 it **succeeds**. The roadmap's own
*How we'd know this failed* list reads: *"The upload path changes behaviour a person can notice."* A
permission **widening** is the most noticeable kind. `229-CONTEXT` D-17 justifies it as
*"forward-compatibility … never hardcodes single-user assumptions"* — a good instinct in the wrong phase.

**(b) Even if kept, the predicate is the WRONG ONE.** The plan reads the **flat column**
`folders.is_org_shared`. The product's own definition is `folder_is_org_shared(uuid)`, measured live:

```sql
WITH RECURSIVE ancestors AS (
  SELECT id, parent_id, is_org_shared FROM public.folders WHERE id = p_folder_id
  UNION ALL
  SELECT f.id, f.parent_id, f.is_org_shared FROM public.folders f
    INNER JOIN ancestors a ON f.id = a.parent_id
) SELECT COALESCE(bool_or(is_org_shared), false) FROM ancestors;
```

**It walks ANCESTORS**, and it is the function the `documents` RLS policy already uses. So a folder nested
inside an org-shared parent is **org-shared to RLS and not-org-shared to this check**. That is two
definitions of one word in one product — the Phase 214 *"two predicates sharing an argument"* failure class,
and it would ship a document that RLS shows org-wide but the upload door refused to accept.

**Close it by:** removing the widening from `229-01` — keep `user_id != caller → 403` **byte-for-byte** —
and routing D-17 to **Phase 231**, which is the phase actually designing visibility and already owns the
four RLS sites. ⚠ If the operator wants it in 229 regardless, it MUST call `folder_is_org_shared(folder_id)`
and never the flat column, and carry a test for a folder nested under an org-shared parent.

### ⛔ G-2 (BLOCKING) — `229-03`'s duplicate-attachment must_have cannot hold as specified

The must_have: *"Two distinct emails carrying an identical attachment both succeed and link correctly."*

The dedupe SELECT filters `status == 'completed' AND is_latest == True`. **The unique index covers
`status <> 'failed'`** (V-3) — which includes `pending` and `processing`. So in the window that actually
matters — two attachments inside one ingest run, or two emails arriving close together — the first row is
still `pending`, the SELECT **misses**, the INSERT **collides on 23505**, and `mint_document_row` raises
**409**. `229-03`'s per-attachment `try/except` then records that attachment as **`failed`**, not **`linked`**.
The must_have would be flaky-green at best and wrong at worst.

**Close it by:** having the attachment path treat `23505` as *"someone else just minted this"* — re-query and
return `MintResult(is_duplicate=True, document=<existing row>)` instead of raising.

⚠ **Do NOT fix it by relaxing the dedupe SELECT to include `pending`/`processing`.** That would change
`/upload`'s documented 409 race behaviour (Phase 078 D-078-04) and break SC#4. **The two callers need
different `23505` dispositions**, so the splice signature should carry that explicitly rather than leaving
it to the caller's `except` — e.g. `on_conflict: Literal["raise","link"] = "raise"`.

### G-3 — the status / `ingestion_step` sequence is asserted at its endpoints, not pinned

The seam table says status *"progresses through `'processing'` to `'completed'` or `'failed'`"*.
`ingestion_step` is a real column with existing values, and the Library badge renders both. SC#4 is about
what a person can **see** — so identical start and end states are not sufficient if the intermediate
sequence changed.

**Close it by:** recording the exact sequence of `status` + `ingestion_step` values today's `_upload_pipeline`
writes, and asserting the extracted `splice_document` writes the **same sequence**, not merely the same
terminal values.

### G-4 — `created_at` / `updated_at` become explicit where today they are DB defaults

`229-01`'s `doc_data` sets both from Python. Today's `/upload` `doc_data` (`documents.py:670-684`) **omits
both** and lets Postgres default them. Minor, but it is a change on the upload path, and it moves the
timestamp source from the database clock to the app container's — which becomes visible as ordering drift
under skew.

**Close it by:** dropping both keys (keep the DB defaults), or stating why they are needed.

### G-5 — name the four chunk-write sites; an unnamed "all four" can pass while covering three

`229-03`'s must_have says *"All four chunk-write sites … remain preserved and functional"* but no plan names
them. Measured, so the plans do not have to re-derive:

| # | Site | What it writes |
|---|---|---|
| 1 | `backend/app/api/documents.py:2338` | text chunks |
| 2 | `backend/app/services/multimodal_service.py:435` | table chunks |
| 3 | `backend/app/services/multimodal_service.py:913` | image chunks |
| 4 | `backend/app/api/documents.py:2534` | the authoritative `chunk_count` recount |

**Close it by:** naming these four in `229-03`, and asserting each — site 4 in particular, since a recount
that runs before sites 2-3 finish silently under-reports.

### G-6 — reachability: name the route by which an email actually enters

`229-03` refactors the attachment cascade, but no plan states how an email reaches it in the product today
(an `.eml` / `.msg` upload through `/upload`?). SC#3 — *"an email carrying two attachments puts both into
the Library"* — must be **drivable at verification**, not only exercisable from a fixture.

**Close it by:** naming the entry route in `229-03`. If the cascade is only reachable via a test fixture,
say so plainly — that is a finding about the feature, not a gap in the plan.

### G-7 — re-derive the G-5 ledger triple at `229-04`, not from the roadmap

`229-04` discharges G-5 on `documents.py`. The roadmap quotes `73 / 30 / 2562` against a stale cell of
`72 / 30 / 2535` — but **three plans will have edited that file** by the time `229-04` runs, and this
project measured 8 of 12 ledger rows drifted at roadmapping.

**Close it by:** re-deriving the triple at that moment with the CLAUDE.md recipe, and updating the CLAUDE.md
row **and** its `docs/HOT-FILE-LEDGER.md` section in the **same commit** — a row without a section is drift
by this project's own rule, and `229-04`'s seam 4 already names this correctly.

---

## 3. Checks run and found clean

- **Migrations** — none needed; every column exists (V-2). Correct that no plan declares one.
- **HTTP contract** — 200/201 preserved and explicitly pinned (V-4).
- **G-2 (sketch-first)** — does not fire: pure refactor, no UI surface.
- **G-1 (phase-chain cap)** — does not fire: no `.N` insert proposed.
- **`user_setup`** — `[]` on all four plans, correct.
- **Threat model** — `229-01` carries one (TM-229-01/02/03) with a mitigation per threat. ⚠ Note TM-229-01's
  mitigation is the **subject of G-1** — it is the widening, written as a mitigation.

---

## 4. Verdict

**`execute` — 7 gaps. `G-1` and `G-2` are BLOCKING and must be settled before the code they touch is written.**

1. **`G-1` first** — it is a deletion, not an addition, and it removes a security-shaped change from a
   refactor phase. Cheapest possible fix.
2. **`G-2`** — decide the `23505` disposition per caller before either caller is written.
3. `G-3`–`G-7` close inside the waves that already own them.

⭐ **The strongest thing about this plan set:** the mechanical field-derivation table did what Phase 228's
seam audit could not — it traced eight fields to their consumers and caught the duplicate-attachment
collision before a line was written. Both blocking findings sit *inside* territory that table already
mapped, which is the difference between an audit that works and one that is merely present.

*Reviewed: 2026-09-05 · Builder: Gemini · Reviewer: Claude*
