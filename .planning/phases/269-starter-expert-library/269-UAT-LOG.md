# 269 UAT Log — live proof of PACK-26 / PACK-27 (plan 269-03)

Drives by Claude (plan 269-03, Tasks 2-3) on 2026-09-29 against the LOCAL stack: backend
`http://localhost:8000` (`/health` → `{"status":"ok","redis":"ok","maintenance":false}`, restarted by the
operator after the wave-1 merge), vite `http://localhost:5173`, Postgres `127.0.0.1:54322`, local GoTrue
`127.0.0.1:54321`. The Supabase MCP (production) was NOT used for anything. Every row carries its own
request and its own SQL; raw transcripts are under `evidence/`. Helper scripts, tokens and passwords lived
only in the session scratchpad, never in the repo; `Authorization` headers are quoted as `<redacted>`.

- **PHASE_BASE** `0300bf94260447704d5f82bde0c5d839443d9699` · **HEAD while driving** `b081cefd5f6ab0586db5cb9092e01293a63a0f5c`
- **Model / provider (every chat row):** `deepseek-v4-flash` / `deepseek` — the app's configured default
  (`app_settings.global.llm_provider/llm_model`), sent per request in the `POST /threads/{id}/messages` body.
  No global setting was changed.
- **Embedding model:** `text-embedding-3-small` (`embedding_provider=openai`, 1536 dims, `app_settings.global`).
- **Web search:** `app_settings.global.web_search_enabled = true` (Tavily key via env, RESEARCH M-11), so
  `web_search` was AVAILABLE in every Expert thread and every cited/refusal turn counts it.

## Task 1 (operator checkpoint — completed before this drive)

- Merged-tree targeted tests `test_269_*` (3 files): **35 passed, 0 failed**.
- Full backend baseline (`pytest tests/unit -q --continue-on-collection-errors`): **71 failed, 6009 passed,
  1 skipped, 2 xfailed, 2 xpassed** — at the ceiling 71, zero headroom, no new failure.
- Slug bijection: candidate SQL slugs `{contract-reviewer, hr-policy-advisor, operations-analyst,
  security-compliance}` == the four new `CORPORA_ROOT` dirs; `financial-analyzer` pre-existing.
- **Candidate SQL applied by the operator-authorized asyncpg path.** The operator explicitly authorized
  Claude to apply `269-candidate-bundles.sql` ("you apply it"); it was applied to the LOCAL DB
  (`127.0.0.1:54322`, confirmed local — NOT production) through the backend venv with
  `settings.postgres_dsn`. Read-back: 5 `is_system` rows, `org_id` NULL, all `restricted` (ids `…2691`-`…2694`,
  `…0259`); financial-analyzer `example_output` contains `30.8%` and no `24.3`.

## Fixtures (all LOCAL) — `evidence/00-users-and-orgs.txt`

| who | user_id | membership in the test org | how |
|---|---|---|---|
| admin `uat269-admin-406a18@example.test` | `b93a9c96-2de1-4e13-958c-10e5d6775fd0` | **test org `9042e46f-745d-40d6-83eb-c6984d582ce1`** (org-admin, personal org) | public `POST /auth/v1/signup` (anon key from `GET /public-config`); `handle_new_user` created the org |
| member `uat269-member-406a18@example.test` | `046ac4e2-02ee-40db-93dd-1d53bbf006ea` | test org as `member` (also org-admin of its own personal org `0074ea41-…`) | same signup, then LOCAL `INSERT INTO org_members (…, 'member')` (266 precedent), re-read |

**Active-org proof method:** every request sent `X-Org-Id: 9042e46f-745d-40d6-83eb-c6984d582ce1`, and every
written or cited row was checked by its own `org_id` — `expert_installs`, `documents`, `folders`,
`document_chunks`, `threads`, `runs` (SEED-314 answered: `runs.org_id` == the test org on all 10 runs,
`runs.expert_id` == the bundle, `expert_attributed = true`) and assistant `messages`. `audit_log.org_id` was
never used as evidence; retrieval is proven by joining `search.query` `metadata->'document_ids'` to
`documents.org_id` / `documents.folder_id`.

## SC#1 — first run, qualified per D-269-P1

**D-269-P1 (operator ruling, quoted):** tiers stay operator-assigned; no `handle_new_user`, tier or
capability change; SC#1 holds for **"an org on the enterprise tier sees the starter library"**. A NULL-tier
signup sees the tier refusal — which is what was measured:

1. Fresh signup → `organizations.subscription_tier = NULL` (`evidence/00`).
2. `GET /experts` with `X-Org-Id` → **HTTP 403** with the tier sentence, never a blank page (D-269-06):
   `"Capability 'experts' requires 'enterprise' tier (current tier: 'unassigned')" … "upgrade_hint":"Upgrade to Enterprise to use experts."` (`evidence/01` part A).
3. **Named step "F-4 operator tier assignment (D-269-P1)"** — LOCAL `UPDATE organizations SET
   subscription_tier = 'enterprise' WHERE id = '9042e46f-…'` → `UPDATE 1`; before `None`, after
   `'enterprise'` (`evidence/00`). No code, no migration.
4. `GET /experts` → HTTP 200, **exactly the five starter slugs**, each `install.state = not_installed`,
   `can_install = true` for the admin; `GET /experts/{id}` returns icon / category / when_to_use /
   example_output for all five (financial-analyzer shows the D-269-P2 corrected `30.8%` / `$29.1M`)
   (`evidence/01` part B).
5. Member: `can_install = false` on all five (the not-installed reason state, D-269-06) (`evidence/02`).

SC#1 is claimed ONLY for an org on the enterprise tier — never for a raw NULL-tier signup.

## Verdict table (per Expert, one fresh enterprise-tier org)

Install folders (all in the test org): financial-analyzer `cc435f1e-…`, contract-reviewer `c33b2abd-…`,
hr-policy-advisor `d495a71d-…`, security-compliance `16db0107-…`, operations-analyst `ac0768c8-…`.

| slug | install | cited (figures) | refusal (sibling literal) | web_search_calls (cited / refusal) |
|---|---|---|---|---|
| financial-analyzer | PASS — `03-financial-analyzer-install.txt` (1 doc, 3/3 chunks embedded) | **PASS** ¹ — `03-financial-analyzer-cited.txt` (`30.8%`, `$29.1`) | PASS — `03-financial-analyzer-refusal.txt` (`23 days` absent) | 0 / 0 |
| contract-reviewer | PASS — `04-contract-reviewer-install.txt` (2 docs, 10 chunks embedded) | PASS — `04-contract-reviewer-cited.txt` (`$2.35M`, `75 days`) | PASS — `04-contract-reviewer-refusal.txt` (`94.7` absent) | 0 / 0 |
| hr-policy-advisor | PASS — `05-hr-policy-advisor-install.txt` (2 docs, 8 chunks embedded) | PASS — `05-hr-policy-advisor-cited.txt` (`18 weeks`, `23 days`) | PASS — `05-hr-policy-advisor-refusal.txt` (`2.35` absent) | 0 / 0 |
| security-compliance | PASS — `06-security-compliance-install.txt` (2 docs, 8 chunks embedded) | PASS — `06-security-compliance-cited.txt` (`36 hours`, `14 of 16`) | **FAIL** ² — `06-security-compliance-refusal.txt` (`124.5` absent, but an out-of-folder document was retrieved) | 0 / 0 |
| operations-analyst | PASS — `07-operations-analyst-install.txt` (2 docs, 7 chunks embedded) | PASS — `07-operations-analyst-cited.txt` (`94.7%`, `38 days`) | PASS — `07-operations-analyst-refusal.txt` (`18 weeks` absent) | 0 / 0 |

Every install used only `POST /experts/{id}/install` (D-269-08): 202 → `installing` → `ready`,
`expert_installs.status = installed`, every document `completed` with `chunk_count > 0`, a non-zero
`embedding IS NOT NULL` chunk count, and zero chunks outside the test org.

Every cited PASS: each literal regex-matched in the answer; every `search.query` joined document is in the
test org AND in that Expert's install folder; a `document_chunks` row in that folder carries each literal;
`web_search_calls: 0`. Every turn was driven ONCE; nothing was re-driven.

¹ **financial-analyzer cited — checker defect corrected, answer NOT re-driven.** The drive helper first
computed `FAIL — literal $29.1 not in answer` because its regex `\$29\.1\b` cannot match `$29.1M` (`\b`
needs a word/non-word transition; `1`→`M` is word→word). The answer reads "**Operating cash flow:
$29.1M**". The persisted message was re-read from the DB and re-checked with `\$29\.1(?!\d)`; the
superseded helper line and the correction are both kept in the file above its single `VERDICT: PASS`.
The Drive-table literal (`$29.1`) was not changed. The helper was fixed before any further drive.

² **security-compliance refusal — FAIL (T-269-09, a platform scope finding, not a corpus finding).** The
answer refused, did not contain `124.5`, and every `search.query` document was in its own folder — so the
helper, which measured `search.query` only, first computed PASS. A supplementary read-only scan of EVERY
tool result of every turn (appended to all ten files) found that in this one turn the agent ran
`query_documents` with raw SQL over `documents`, and it returned the Financial Analyzer's document
`297c6ee8-739f-4b64-b5d6-073957e9f0b1` (`acme_q3_2026_financial_report.md`, title "ACME Corporation - Q3
2026 Financial Results and Form 10-K Report", folder "Financial Reports & Filings") — **outside this
restricted Expert's install folder**. The answer then disclosed that file's name and title and offered to
"step outside the current scope". The plan's refusal rule is "no out-of-folder document was retrieved",
so the verdict is `VERDICT: FAIL` (the superseded helper line is kept in the file). The other nine turns
scanned clean (0 out-of-folder hits; contract-reviewer and operations-analyst also called
`query_documents`, but their queries matched nothing foreign).
- ⚠ **This is not specific to the Security & Compliance Expert.** It is the `query_documents` tool path;
  any restricted Expert whose agent chooses that tool can see sibling-folder document metadata (id,
  filename, title) in the same org. Unverified hypothesis for the fix owner:
  `tool_dispatcher._handle_query_documents` (`tool_dispatcher.py:978-983`) bounds by
  `ctx.folder_subtree_ids`, which an Expert-scoped thread with no folder may leave unbounded, while
  `search_documents` applies the Expert scope. No cross-tenant read was seen (the document is in the
  same org). No code was touched here.
- Routed to **269-04 Task 1** for the operator: hold back security-compliance (D-269-09 default), or
  a recorded re-drive, or a platform ruling (the defect equally affects the four PASS Experts, whose
  turns simply did not exercise it). Recommend a `reported-bugs` entry for the `query_documents` scope gap.

## SC#10 cross-provider disposition

**Does not fire — no streaming/agent-loop/provider-routing/UI-state change; PACK-27 asks for one live
conversation per Expert.** All ten turns ran on `deepseek-v4-flash` / `deepseek`.

## Inherited dependency — 267

**267 is human_needed — its independent review and operator G-4 confirmation are owed; 269 inherits 267's
shipped additive-scope behaviour (D-267-01) as an INHERITED DEPENDENCY and does not claim 267 verified.**
(`267-VERIFICATION.md`: `status: human_needed`, `verification_mode: self-verified`.)

## Evidence honesty (SC#4 / D-269-09)

No mock or fixture test is cited as evidence for any verdict above; every verdict is written from the live
drive and its SQL. The Drive table (questions and literals) was fixed in `269-03-PLAN.md` before driving and
never changed. One attempt per turn; the FAIL is recorded, not re-driven.

## G-4 screenshots

**SCREENSHOTS OWED — operator captures at 269-04 Task 1.** This executor had no Chrome tool, so
`g4-00` … `g4-06` were not captured. Credentials for the uat269 admin and member users are in the session
scratchpad (`state.json`), handed over by the orchestrator — never in the repo.

## Operator lock (269-04 Task 1)

**Date:** 2026-09-29.

**What the operator was shown.** The orchestrator presented the verdict table above (every evidence
file's `VERDICT:` line, the one FAIL quoted with its reason) and this recommendation, quoted verbatim —
it is the ORCHESTRATOR's text, not the operator's:

> "G-2 accepted; LOCK financial-analyzer, contract-reviewer, hr-policy-advisor, operations-analyst; HOLD security-compliance"

**The operator's reply, verbatim:**

> `proceed`

**How it is applied.** The operator's literal word was **"proceed"**. It is recorded here and applied as
acceptance of the recommendation quoted above — the operator did not type the LOCK/HOLD list; they
accepted it. Nothing beyond that recommendation is read into the reply.

| slug | install | cited | refusal | decision |
|---|---|---|---|---|
| financial-analyzer | PASS (`03-…-install.txt`) | PASS (`03-…-cited.txt`) | PASS (`03-…-refusal.txt`) | **LOCK** (already shipped by mig 187; D-269-P2 copy UPDATE ships in 198) |
| contract-reviewer | PASS (`04-…-install.txt`) | PASS (`04-…-cited.txt`) | PASS (`04-…-refusal.txt`) | **LOCK** |
| hr-policy-advisor | PASS (`05-…-install.txt`) | PASS (`05-…-cited.txt`) | PASS (`05-…-refusal.txt`) | **LOCK** |
| operations-analyst | PASS (`07-…-install.txt`) | PASS (`07-…-cited.txt`) | PASS (`07-…-refusal.txt`) | **LOCK** |
| security-compliance | PASS (`06-…-install.txt`) | PASS (`06-…-cited.txt`) | **FAIL** (`06-…-refusal.txt`) | **HOLD** (D-269-09 default for a FAIL) |

**G-2 answer.** The live-rendered first-run catalog (evidence `01-catalog-first-run.txt` /
`02-member-reason.txt`, driven through the real API) is accepted as the G-2 acceptance bar; no component
was changed (D-269-06). ⚠ **Screenshots `g4-00` … `g4-06` are still OWED** — 269-03 had no Chrome tool,
and this acceptance was given on the API-level evidence and the verdict table, not on captured images.
The owed screenshots are not claimed as taken.

**HELD BACK — security-compliance — refusal FAIL: `query_documents` returned a sibling-folder document
(`297c6ee8-…`, the Financial Analyzer's report) outside the restricted Expert's install folder, and the
answer disclosed its filename/title — evidence `06-security-compliance-{install,cited,refusal}.txt`.**
Per D-269-09 (ship fewer, never weaken): its candidate row (`…2693`) is NOT promoted to migration 198,
its corpus directory `backend/app/experts/corpora/security-compliance/` is deleted from the tree, and its
three evidence files are KEPT. Its local `expert_bundles` row is deleted in Task 3 by the operator. The
library ships **four** starter Experts (financial-analyzer + three new), not five, and is not padded.
⚠ The cause is the platform `query_documents` scope gap described in footnote ² above, which equally
affects the four LOCKed Experts' tool surface (their turns simply did not exercise it) — the hold is the
evidence rule, not a claim that the four are immune.

**Pre-deletion dependency check (measured, not assumed).** Before deleting the held corpus, every LOCKed
Expert's refusal evidence was read for its sibling literal: financial-analyzer → `23 days` (hr-policy-advisor),
contract-reviewer → `94.7` (operations-analyst), hr-policy-advisor → `2.35` (contract-reviewer),
operations-analyst → `18 weeks` (hr-policy-advisor). **None uses the security-compliance corpus.** The
security-compliance folder `16db0107-…` was PRESENT as an extra sibling in the test org during those turns,
and each of their supplementary scans reads `out_of_folder_documents_retrieved_by_any_tool: 0`, so no locked
verdict depends on (or was contaminated by) the held corpus. The cited turns cite only each Expert's own
figures (`30.8%`/`$29.1`, `$2.35M`/`75 days`, `18 weeks`/`23 days`, `94.7%`/`38 days`).

## 198 applied (local) — 269-04 Task 3, 2026-09-29

Operator instruction: "you do it" (answering the offer to apply 198 and run steps 1-4 against the local DB). Target confirmed local: 127.0.0.1:54322. No `supabase db push` / `db reset`, no `--reset`, production Supabase MCP not used.

1. `supabase/migrations/198_starter_expert_library.sql` applied via asyncpg (idempotent upsert over the 269-03 candidate rows).
2. Held row removed locally: `DELETE FROM public.expert_bundles WHERE id = '00000000-0000-0000-0000-000000002693' AND is_system` -> `DELETE 1`. The test org's copied security-compliance documents and folder `16db0107-...` stay in place.
3. `bash scripts/regenerate-full-schema.sh` (live-DB dump, no reset): completed, 8836 lines; `git diff --stat supabase/full-schema.sql` empty = zero diff, as expected (schema-only dump, 198 changes data only, M-8).
4. Read-back: `expert_bundles WHERE is_system` returns exactly contract-reviewer, financial-analyzer, hr-policy-advisor, operations-analyst — all restricted, org_id NULL (portable), is_enabled true. Financial Analyzer `example_output LIKE '%30.8%'` = true.
