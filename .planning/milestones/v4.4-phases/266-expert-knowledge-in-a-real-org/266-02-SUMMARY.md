---
phase: 266-expert-knowledge-in-a-real-org
plan: 02
subsystem: experts / ingest
tags: [experts, corpus, extension-contract, ingest, multi-org, tdd]
requires: []
provides:
  - "backend/app/services/expert_corpus.py: load_corpus, has_corpus, normalise_bytes, ExpertCorpus, CorpusFile, CorpusRefused, CorpusNotFound, CORPORA_ROOT (consumed by 266-03)"
  - "backend/app/experts/corpora/financial-analyzer/ (manifest.json + verbatim 188 report)"
  - "mint_document_row org-scoped at 4 sites when org_id is passed (D-266-18)"
  - "SEED-313 (RESEARCH C-8)"
affects:
  - backend/app/services/sources/import_service.py (passes org_id, so it is now org-scoped; file unchanged)
  - backend/app/services/watch_service.py (same)
tech-stack:
  added: []
  patterns:
    - "corpus as DATA: path-contained reads, never imports (Extension Contract)"
    - "build-then-branch `if org_id:` arm (the link_query folder-arm idiom)"
    - "in-memory fake Supabase client that APPLIES filters, so a missing predicate returns the wrong row"
key-files:
  created:
    - .gitattributes
    - backend/app/experts/corpora/financial-analyzer/manifest.json
    - backend/app/experts/corpora/financial-analyzer/acme_q3_2026_financial_report.md
    - backend/app/services/expert_corpus.py
    - backend/tests/unit/test_266_corpus_verbatim.py
    - backend/tests/unit/test_266_mint_org_scope.py
    - .planning/seeds/SEED-313-upload-never-stamps-the-active-org.md
  modified:
    - backend/app/services/ingest_splice.py
decisions:
  - "Slug and filename regexes use fullmatch, not match: `$` also matches before a trailing newline, so `financial-analyzer\\n` would have passed SLUG_RE (tested)"
  - "The version lookup was restructured to build filters, add the org arm, then order/limit/execute, so the org_id=None sequence is identical to base"
  - "Seed id 313 was free; no rename needed"
metrics:
  duration: "~45 min"
  completed: 2026-09-24
  tasks: 2
  files: 8
---

# Phase 266 Plan 02: Corpus as repo data + org-scoped mint Summary

The Financial Analyzer's sample report now ships as repo data: a file byte-equal to migration 188's `full_markdown`, LF-pinned, and read by a loader that validates the slug and every filename before touching the filesystem and cannot resolve outside its directory. `mint_document_row` is now org-scoped at all four query sites whenever an `org_id` is passed (D-266-18), while `/upload` (`org_id=None`) issues exactly the base query sequence.

## Tasks

| # | Task | RED commit | GREEN commit |
|---|------|------------|--------------|
| 1 | Corpus as DATA + path-contained, OS-stable loader (D-266-05) | `b52a10798` | `2159a02f5` |
| 2 | Org-scoped mint dedup/versioning (D-266-18) + seed for C-8 | `dd6fb6a47` | `26227449b` (+ seed `ba9c62571`) |

## Task 1: evidence

**RED** (before the module existed):
```
E   ImportError: cannot import name 'expert_corpus' from 'app.services'
!!!!!!!!!!!!!!!!!!! Interrupted: 1 error during collection !!!!!!!!!!!!!!!!!!!!
```
**GREEN:** `26 passed`.

- **Byte-equality was checked on the committed blob, not the working copy.** `git show HEAD:…/acme_q3_2026_financial_report.md` was byte-compared (`cmp`) with the literal extracted from `188_expert_chat_scoping.sql` and the result was `BYTE-EQUAL`, 2359 bytes each, 29 lines. The test also extracts the literal from the migration file itself rather than a retyped copy.
- `git ls-files --eol backend/app/experts/corpora`:
  ```
  i/lf    w/lf    attr/text eol=lf      backend/app/experts/corpora/financial-analyzer/acme_q3_2026_financial_report.md
  i/lf    w/lf    attr/text eol=lf      backend/app/experts/corpora/financial-analyzer/manifest.json
  ```
  For contrast, migration 188 itself reads `i/lf w/crlf` in this checkout (`autocrlf=true`). Without the `.gitattributes` rule the corpus working copy would have been CRLF too.
- C-7 is pinned: the bytes contain `$124.5` and `+18.2%`. They contain neither `$124.5M` nor `124.5 million`.
- A CRLF copy in `tmp_path`, with `CORPORA_ROOT` monkeypatched, gives the same `corpus_version` and the same per-file sha256.
- There are no `*.py` files under `backend/app/experts`, including no `__init__.py`. A Glob found none, and a test fails if one appears.
- `git check-ignore` on the corpus file exited 1, so the file is not ignored. `backend/.dockerignore` excludes `venv/`, caches, logs, `.env*`, `tests/`, `supabase/`, `Dockerfile.sandbox`, `.dockerignore` and `RUN-BACKEND.md`. It excludes neither `app/` nor `*.md`, and the `Dockerfile` does `COPY . .`, so the corpus ships in the image.
- Refusal cases:
  - Slugs `../x`, `Financial`, `a/b`, `""`, `..`, `a\b`, `financial-analyzer/` and `financial-analyzer\n` raise `CorpusRefused`.
  - Manifest filenames `../../secret.txt`, `sub/x.md`, `..`, `a..b.md`, `/etc/passwd` and `C:x.md` also raise `CorpusRefused`.
  - A well-formed slug with no directory raises `CorpusNotFound`. So does a directory with no manifest, and `has_corpus` returns False for it.

## Task 2: evidence

**RED** against the base `ingest_splice.py`: `5 failed, 3 passed`.
```
FAILED test_every_site_is_org_scoped_when_org_is_passed        — AssertionError: (a) dedup select is not org-scoped
FAILED test_dedup_hit_is_only_reachable_from_the_same_org      — AssertionError: org A's document was returned as org B's 'already here'
FAILED test_versioning_and_retirement_never_touch_another_orgs_row — assert 2 == 1
FAILED test_retirement_update_is_filtered_by_the_installing_org — assert False  (org A's row un-latested)
FAILED test_link_requery_never_adopts_another_orgs_row
```
The 3 cases that passed on base are expected to pass there. They are the `/upload` base-sequence pin, the no-`org_id`-in-insert pin, and the same-org dedup case.

**GREEN:** `8 passed`.

- `grep -c 'eq("org_id", org_id)' backend/app/services/ingest_splice.py` returns **4**, and `grep -c "D-266-18"` returns **2**.
- The four sites are asserted **separately**, each by its own role: the dedup select, the `id, version_number` select, the `{"is_latest": False}` update, and the link `neq(status, failed)` select.
- The fake client applies the filters it receives. A missing predicate therefore returns org A's row instead of just missing a call.
- The `org_id=None` test compares the complete (method, args, kwargs) sequence of all 5 query sites, including `order` and `limit`, with the sequence the base code issues.
- `git diff --quiet 522e7b4fc HEAD -- backend/app/api/documents.py backend/app/services/sources/import_service.py` exits 0.
- Mint blast radius (every `tests/unit` file that references `mint_document_row`):
  - Files: `test_ingest_splice.py`, `services/test_watch_service.py`, `services/sources/` (whole directory), `test_240_attachments_both_paths.py`, `test_244_cloud_attach_is_thread_scoped.py`, `test_244_import_destination_required.py`, plus both 266 files.
  - Result: **455 passed, 0 failed**.
  - Not run: `tests/integration/test_230_upload_queue_cutover.py`. It is an integration suite, and this plan does not mutate the DB.
- Seed: `node scripts/check-seeds-register.cjs` read `320/320 parsed, 0 duplicate ids, 320/320 carry all 5 required keys`. SEED-313 was free, so no rename was needed. Before writing the seed, its claims were checked against the code:
  - `documents.py:674` reads `current_user.get("org_id")`.
  - `get_current_user` returns `{"id", "email"}` (`dependencies.py:370`).
  - Migration 106 runs `LIMIT 1` over `org_members` with no ORDER BY (`:97-101`).

## Full backend baseline

`node scripts/check-backend-unit-baseline.cjs` gave `71 failed, 5568 passed, 1 skipped, 2 xfailed, 2 xpassed`, errors 0, and **GATE PASSED** (71 ≤ 71). The gate keeps no failure list, and only the tail of its output was captured. So the claim that none of the 71 belong to this plan rests on the targeted runs above: every suite this plan touches or affects ran green in isolation.

## Deviations from Plan

**1. [Rule 2: correctness] `fullmatch` instead of the `^…$` regex's `match`.** `SLUG_RE` as specified (`^[a-z0-9-]+$`) accepts `financial-analyzer\n` under `re.match`, because `$` also matches before a trailing newline. The loader uses `SLUG_RE.fullmatch` and `FILENAME_RE.fullmatch` and keeps the regex literals exactly as the contract gives them. A trailing-newline slug case was added to the refusal tests. Files: `expert_corpus.py`, `test_266_corpus_verbatim.py`. Commits: `b52a10798`, `2159a02f5`.

**2. [Rule 2: hardening] Extra manifest checks beyond the contract.** The loader also refuses:
- a manifest entry named `manifest.json`
- a filename listed twice
- a missing or empty `mime_type` / `folder_name` / `files`
- a resolved file whose parent is not exactly the slug directory (on top of `is_relative_to`)

A listed file that does not exist raises `CorpusNotFound`. None of these change the public contract 266-03 consumes.

**3. Docstring bullet 3 was stale before this plan.** At base it said *"folder-scoped check for status='completed' AND is_latest=True"*, but the code had been user-scoped with no `is_latest` since BUG-260905-02. It was rewritten along with bullet 4, as the plan asked, so it now states the index predicate accurately.

Otherwise the plan was executed as written.

## Deploy ordering (carried for 266-05)

The org-scoped check is safe only once migration 195's widened `documents_completed_hash_unique_idx (org_id, user_id, content_hash)` exists. Under the old `(user_id, content_hash)` index, a second org's completion write would still raise 23505. Plan 266-01 owns 195, so this plan never touched the live index.

## Threat Flags

None. No new network endpoint, auth path or schema change. The corpus loader is a new file-read surface, and T-266-08 and T-266-09 cover it; both are mitigated and tested.

## Known Stubs

None.

## TDD Gate Compliance

Both tasks have a `test(266-02)` RED commit followed by a `feat(266-02)` GREEN commit: `b52a10798` → `2159a02f5` and `dd6fb6a47` → `26227449b`. No refactor commits were needed.

## Self-Check: PASSED

- FOUND: every file listed under key-files.created / modified
- FOUND commits: b52a10798, 2159a02f5, dd6fb6a47, 26227449b, ba9c62571
- STATE.md and ROADMAP.md not modified
