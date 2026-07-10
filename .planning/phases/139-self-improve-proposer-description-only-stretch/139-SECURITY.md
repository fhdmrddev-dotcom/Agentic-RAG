# 139-SECURITY.md — Phase 139 (SI-02) description-only self-improve proposer

**Phase:** 139 — self-improve-proposer-description-only (SI-02)
**Mode:** VERIFY-MITIGATIONS (registers authored at plan time across 5 PLAN.md files)
**ASVS Level:** L1  ·  **block_on:** high
**Result:** SECURED — 21/21 threats CLOSED (16 mitigate + 5 accept), 0 OPEN
**Audited at:** HEAD `2a804db8` (phase base `d094fa13^`)

Every mitigation was verified present in shipped code — not accepted from documentation or
intent. Evidence is `file:line` of the actual control (owner gate, kind-gate, `run_in_threadpool`
wrap, CHECK constraint, absence of a raw-HTML sink, the `handleConfirmWinner` repoint, full-schema
parity). Implementation files were treated as read-only; nothing was patched.

---

## Threat Verification

| Threat ID | Category | Disp. | Status | Evidence |
|-----------|----------|-------|--------|----------|
| T-139-01 | Information Disclosure (RLS) | mitigate | CLOSED | `migrations/090_...sql` is a pure additive `ALTER TABLE` — no `CREATE POLICY`/`GRANT` (widened RLS absent); the mig-083 owner-only SELECT scopes every new column. Runtime gate is the route `.eq("user_id", …)` on every read/write — `evals.py:1171,1327,1451` (`_verify_owned_skill`). |
| T-139-02 | Tampering (integrity CHECK) | mitigate | CLOSED | `skill_proposals_kind_fields` partial CHECK, both kind branches: `migrations/090_...sql:54-58` AND `full-schema.sql:992`. |
| T-139-03 | Tampering (stale FK) | mitigate | CLOSED | FK `ON DELETE SET NULL` provenance-only: `090_...sql:40-41`, `full-schema.sql:2784`. Evidence copied INLINE at propose-time (not read via FK): `evals.py:1282-1297` (`scoreboard_snapshot = {winner, baseline, run_id}`). |
| T-139-04 | Elevation of Privilege (IDOR) | mitigate | CLOSED | Owner gate runs FIRST on every route: propose `evals.py:1171`, approve `:1451`; reject verifies `id`+`user_id`+`skill_id`+`kind` before any write `:1372-1382`. |
| T-139-05 | Information Disclosure (existence leak) | mitigate | CLOSED | 404-not-403 on every miss; malformed UUID → 404 via try/except: `_verify_owned_skill` `evals.py:133-142`; reject `:1384-1390`; approve `:1464-1470`; tuner read `:1208-1214`. |
| T-139-06 | Spoofing (forged body id) | mitigate | CLOSED | `ProposeDescriptionBody` carries only `run_id` — `models/eval_run.py:119-129`; `user_id` from `current_user`, `skill_id` from path, never body: `evals.py:1166,1281-1292`. |
| T-139-07 | Tampering/Disclosure (cross-user tuner run) | mitigate | CLOSED | Skill owner-gated first `:1171`; `tuner_runs` read `.eq("skill_id")` after gate `:1199-1206` + observed-`run_id` equality (409 if stale) `:1220`; evidence snapshotted inline `:1282-1286`. |
| T-139-08 | Tampering (prompt-injection into catalog) | mitigate | CLOSED | Winner read as DATA from scoreboard `evals.py:1237`; stored as text column `proposed_description` `090_...sql:38`; rendered as React text node `DescriptionProposalCard.tsx:159-173`; agent loop UNTOUCHED (red-line git check) — no new injection vector, description is data throughout. |
| T-139-09 | Denial of Service (event-loop stall) | mitigate | CLOSED | Every supabase-py call in SI-02 routes `run_in_threadpool`-wrapped. Approve UPDATE (the write) wrapped: `evals.py:1519-1528` (`_apply_description`); also `_read_proposal:1465`, `_read_max_version:1545`, `_promote:1559`, propose `_read_latest_tuner:1209`/`_insert:1305`, reject `_verify:1385`/`_reject:1414`. No bare skills.py:404 pattern. |
| T-139-10 | Tampering (wrong-kind flip) | mitigate | CLOSED | Description reject kind-gated `evals.py:1379,1407`; approve kind-gate `:1475` (409). CR-01 symmetric fix: SI-01 routes now `.eq("kind","instruction")` — `:801,819,864,911,979,1035,1055`. Both directions closed. |
| T-139-10 (apply) | Tampering (destructive apply) | mitigate | CLOSED | Non-destructive SQL-editor/psycopg2 apply + regen with no `--reset` (commit `eaebd826`); migration 090 present AND reflected in `full-schema.sql` (drift check pass). |
| T-139-11 | Repudiation (schema drift) | mitigate | CLOSED | `full-schema.sql` carries the kind column `:987`, `skill_proposals_kind_fields` CHECK `:992`, and `source_tuner_run_id` FK `:2784` — all from migration 090. No drift. |
| T-139-12 | Spoofing (forged client identity) | mitigate | CLOSED | All 4 wires attach `getAuthHeaders()`: `api.ts:1995,2010,2029,2044`; only `proposeDescription` sends a body `{ run_id }` `:1998`; approve/reject/getLatest send no body → no identity in body. |
| T-139-13 | Information Disclosure (wire error leak) | mitigate | CLOSED | All 4 wires route `!res.ok` through `proposalError(...)`: `api.ts:2000,2015,2034,2049`; server returns 404-not-403 so no cross-user existence signal reaches the client. |
| T-139-14 | Tampering (XSS) | mitigate | CLOSED | `DescriptionProposalCard.tsx` renders diff/description/scoreboard as React text nodes only (`:159-173` + `ProviderScoreboard`); no `dangerouslySetInnerHTML` in the skills tree (grep found only test-file assertions of its absence). `CandidateCard.tsx` likewise has no raw-HTML sink. |
| T-139-15 | Elevation of Privilege (one-click live write) | mitigate | CLOSED | `handleConfirmWinner` now calls `proposeDescription` — `SkillTunerPage.tsx:521-527`, NOT `updateSkill`/PATCH; the `useSkills()` destructure omits `updateSkill` `:103`; the only live write is `approveDescriptionProposal` via the owner-scoped approve route `:531-535`. |
| T-139-16 | Spoofing/Repudiation (fabricated baseline diff) | mitigate | CLOSED | Frontend gate `isActionableWinner = isWinner && !candidate.is_baseline` `CandidateCard.tsx:50`, propose door gated `:125`. Backend refuses 400 when winner is None or `is_baseline` `evals.py:1232-1236`. Both directions. |
| T-139-SC (139-01) | Tampering (package install) | accept | CLOSED | Accepted risk — no dependency manifest changed (git diff `d094fa13^..HEAD`: no `requirements*.txt` / `package.json` / lockfile / `Dockerfile.sandbox`). |
| T-139-SC (139-02) | Tampering (package install) | accept | CLOSED | Accepted risk — same evidence (no installs anywhere in the phase). |
| T-139-SC (139-03) | Tampering (package install) | accept | CLOSED | Accepted risk — schema/test/deploy artifact only; no installs. |
| T-139-SC (139-04) | Tampering (package install) | accept | CLOSED | Accepted risk — TS type/wire additions only; no installs. |
| T-139-SC (139-05) | Tampering (package install) | accept | CLOSED | Accepted risk — render-only card + tuner repoint; no installs. |

---

## Accepted Risks Log

- **T-139-SC ×5 (npm/pip/cargo installs)** — disposition **accept**. Verified no package
  installs were added by phase 139: `git diff --name-only d094fa13^..HEAD` shows no
  `requirements*.txt`, `package.json`, lockfile, `pyproject`, `Cargo`, or `Dockerfile.sandbox`
  changes. The 18 changed files are backend routes/models/tests, frontend components/types/tests,
  the migration, and `full-schema.sql`. Supply-chain risk surface is unchanged this phase.

---

## Red Line (D-13)

**HELD.** `backend/app/api/threads.py` and the agent loop (`backend/app/services/agent_loop.py`)
are ABSENT from the phase diff (`git diff --name-only d094fa13^..HEAD`). Their most recent touch
is phase 138 (`18cb617e` / `fbe9beec`), not 139. No shared streaming/agent path was modified.

---

## Unregistered Flags

None. Only `139-03-SUMMARY.md` carries a `## Threat Flags` section, which declares "None beyond
the plan's `<threat_model>`" (T-139-10 destructive-apply + T-139-11 drift, both mitigated). No new
network endpoints, auth paths, or trust boundaries appeared during implementation.

---

## Informational (non-blocking)

- **Stale file-header docstring** — `SkillTunerPage.tsx:22-23` still narrates the pre-139
  one-click PATCH/`updateSkill` diff-confirm strip. This is documentation lag only: the code path
  is repointed (T-139-15 verified — `updateSkill` is not destructured or called; `handleConfirmWinner`
  calls `proposeDescription`). No security impact; cosmetic doc cleanup opportunity.

---

_Verified by gsd-security-auditor. Implementation files read-only; no code patched._
