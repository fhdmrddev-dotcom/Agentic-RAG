# Phase 139: Self-Improve Proposer — Description-Only (STRETCH) - Pattern Map

**Mapped:** 2026-07-06
**Files analyzed:** 12 (4 backend + 5 frontend + 3 test)
**Analogs found:** 11 exact/role-match / 12 — 1 flagged (migration-CHECK DB test has only a partial analog)

> This is a **"wrap existing machinery in a lifecycle"** phase. Almost every new artifact has a
> direct in-repo sibling to mirror — the winner engine (Tuner), the proposal lifecycle (SI-01), the
> diff renderer, the scoreboard, and the version-capture trigger all already ship. Every analog below
> was read on disk this session; line numbers are verified against the live files, not assumed.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|-------------------|------|-----------|----------------|-------|
| `supabase/migrations/090_skill_proposals_description_kind.sql` | migration | schema/DDL | `supabase/migrations/083_skill_proposals.sql` | exact |
| `backend/app/models/eval_run.py` (extend `SkillProposalResponse` + new `ProposeDescriptionBody`) | model | request-response | `backend/app/models/eval_run.py` (self — `SkillProposalResponse` :152, `ProposeBody` :109) | exact (self-extend) |
| Description propose/approve/reject routes (home: `evals.py` OR small sibling — **NEVER `threads.py`**, D-13) | route/controller | request-response (CRUD) | `backend/app/api/evals.py` propose :695 / reject :991 / approve :1459 | exact (drop the async arm) |
| `backend/app/api/skill_tuner.py` (optional winner-fetch helper) | route/service | request-response | `skill_tuner.py` `get_latest_tuner_run` :817 | role-match |
| `frontend/src/types/index.ts` (extend `SkillProposal`) | type/model | — | `types/index.ts` `SkillProposal` :764 (self) | exact (self-extend) |
| `frontend/src/lib/api.ts` (`proposeDescription()` wire fn) | utility (wire) | request-response | `api.ts` `proposeImprovement` :1876 / `approveProposal` :1915 / `rejectProposal` :1945 | exact |
| ProposalCard description variant OR new `DescriptionProposalCard` sibling | component | render-only | `studio/ProposalCard.tsx` :129 | exact |
| `frontend/src/pages/SkillTunerPage.tsx` (`handleConfirmWinner` → "Propose this description") | page/component | request-response | `SkillTunerPage.tsx` :461 (self) | exact (self-modify) |
| `frontend/src/components/skills/tuner/CandidateCard.tsx` (re-label affordance) | component | render-only | `CandidateCard.tsx` :52/:181 (self) | exact (self-modify) |
| `backend/tests/integration/test_139_description_proposals.py` | test | request-response | `tests/test_skill_proposals_router.py` | exact |
| `backend/tests/test_139_migration_090.py` (kind-gated CHECK) | test (DB) | schema-invariant | — (partial — see **No Analog Found**) | flagged |
| `frontend/src/components/skills/studio/DescriptionProposalCard.test.tsx` | test | render | `studio/ProposalCard.test.tsx` (exists) | exact |

---

## Pattern Assignments

### `supabase/migrations/090_skill_proposals_description_kind.sql` (migration, additive DDL)

**Analog:** `supabase/migrations/083_skill_proposals.sql`

**What to copy:**
- **Header discipline block** (083:29-36) verbatim intent — apply via SQL editor / psycopg2 :54322, then `bash scripts/regenerate-full-schema.sh` (no `--reset`), commit migration + regenerated `full-schema.sql` together. Filename `<digits>_name.sql` (no letter suffix).
- **Additive `ALTER TABLE` only** — the table already exists (083:43-59). Add `kind` discriminator, `proposed_description text` (nullable), `scoreboard_snapshot jsonb`, `source_tuner_run_id uuid REFERENCES public.tuner_runs(id) ON DELETE SET NULL`, and `ALTER COLUMN proposed_instructions DROP NOT NULL`.
- **Existing status enum is REUSED unchanged** (083:55 — `CHECK (status IN ('proposed','rejected','approved','re_evaling','promoted','not_promoted','interrupted'))`). Description proposals only ever use `proposed / rejected / approved / promoted` (D-07). **No enum migration.**
- **Kind-gated partial CHECK** — mirror the strong-invariant style of the 083 table constraints + the 079 trigger's `IS DISTINCT FROM` discipline. RESEARCH Pattern 1 (139-RESEARCH.md:236-242) gives the exact shape:
  ```sql
  ADD CONSTRAINT skill_proposals_kind_fields CHECK (
    (kind = 'instruction' AND proposed_instructions IS NOT NULL AND proposed_description IS NULL)
    OR
    (kind = 'description' AND proposed_description IS NOT NULL AND proposed_instructions IS NULL))
  ```
- **RLS / service-role invariants are inherited** — 083 already has owner-only SELECT (`auth.uid() = user_id`, 083:88-91) and NO write policies (service-role router writes bypass RLS, 083:83-95). New columns need no new policy.
- **FK target `tuner_runs`** — from 077: `CONSTRAINT tuner_runs_skill_unique UNIQUE (skill_id)` (077:44), `scoreboard jsonb` (077:38). The FK is **provenance only** — the evidence is snapshotted inline (`scoreboard_snapshot`), because a Tuner re-run upserts `on_conflict="skill_id"` and mutates the row (RESEARCH Pitfall 1; `skill_tuner.py:619-624`).

**`base_skill_version_id` stays NOT NULL** (083:46). For description proposals resolve it from the skill's latest `skill_versions` row (`ORDER BY version_number DESC LIMIT 1`) — every description save versions via the 079 trigger, so latest == current live description (RESEARCH Pitfall 3).

---

### `backend/app/models/eval_run.py` — extend `SkillProposalResponse` + add `ProposeDescriptionBody` (model, request-response)

**Analog:** self — `SkillProposalResponse` (eval_run.py:152-183), `ProposeBody` (:109-116), `PromotionGate` (:128-149)

**What to copy:**
- **Add nullable description fields to `SkillProposalResponse`** — mirror the existing nullable pattern (`new_skill_version_id: UUID | None = None`, :172). Add `kind: str`, `proposed_description: str | None = None`, `base_description: str | None = None`, `scoreboard_snapshot: dict | None = None`, `source_tuner_run_id: UUID | None = None`. **Critical, verbatim from the module docstring (:99-106):** FastAPI strips any field absent from the declared response model, so a field the route WRITES must be born here or it is silently dropped.
- **All fields FLAT single-typed** — never a multi-type list union (Gemini `type:[...]` trap, :10-11 / :105). `str | None`, `dict | None`, `UUID | None`.
- **`ProposeDescriptionBody`** — mirror `ProposeBody` (:109-116): carry ONLY the source pointer (here a `source_tuner_run_id: str`, not `source_eval_run_id`). `user_id` from the auth caller, `skill_id` from the path — **NEVER the body** (T-135-02, :112-114).
- `SkillProposalResponse.proposed_instructions: str` (:175) is currently required — relax to `str | None = None` (or default `""`) so a `kind='description'` row (no instructions) serializes.

---

### Description propose / approve / reject routes (route, request-response CRUD)

**Home (D-13):** extend `evals.py` (its `router` is `APIRouter(prefix="/skills")`, evals.py:72 — the exact prefix SI-01's proposal routes use) **or** a small sibling module on the same `/skills` router. `skill_tuner.py` is also `APIRouter(prefix="/skills")` (skill_tuner.py:64), so a sibling there is equally clean. **NEVER grow `threads.py`.**

**Analog:** `evals.py` — `propose_skill_improvement` :695, `reject_skill_proposal` :991, `approve_skill_proposal` :1459, `_verify_owned_skill` :113, `_proposal_response` :671, open/inflight guards :604-605

**Propose (`POST /skills/{id}/description-proposals`, body `ProposeDescriptionBody {run_id}`, route sets `kind='description'`):**
- **Owner gate FIRST** — copy `_verify_owned_skill` (evals.py:113-142): `.eq("id").eq("user_id")`, 404-not-403 on miss, malformed UUID → 404 (never leak error shape), `run_in_threadpool`-wrapped.
- **Read the Tuner winner from the DURABLE `tuner_runs` row** — mirror `get_latest_tuner_run`'s read (skill_tuner.py:840-847) OR verify `source_tuner_run_id` is owner-or-global-skill scoped (`_fetch_owned_or_global_skill`, skill_tuner.py:177-206) before snapshotting. The winner + candidates + cells live INSIDE `scoreboard` jsonb (skill_tuner.py:560-566: `{ candidates[], winner_index, winner_description }`).
- **Honest-by-construction gate (D-02)** — the winner from `pick_winner` MAY be the baseline (skill_tuner_service.py:642-662 returns `max(measured, key=held_out_score)`). Refuse to propose when `winner is None or winner["is_baseline"]` → 400 "nothing to propose" (RESEARCH Code Examples 139-RESEARCH.md:372-376; mirrors `CandidateCard.tsx:52` `isActionableWinner`).
- **Snapshot INLINE** — write `proposed_description = winner_description` + `scoreboard_snapshot = {winner, baseline, run_id}` onto the row. Do NOT render live from the FK (RESEARCH Pitfall 1).
- **Concurrency guard, kind-scoped** — reuse `_OPEN_PROPOSAL_STATUSES` (evals.py:604) but filter by `kind='description'`; since approve is synchronous (no async in-flight), the open set is effectively just `('proposed',)` — supersede a lingering `proposed` description draft to `rejected` (evals.py:803-814), no `_INFLIGHT` block needed (RESEARCH Runtime State Inventory :297).
- **Service-role INSERT** — id minted app-side (`uuid4()`, evals.py:846), `user_id`/`skill_id` from caller+path never body (:849-851), overlay DB echo over payload (:864-867). Set `kind='description'`, `source_eval_run_id=NULL`.

**Reject (`POST .../{proposal_id}/reject`):** copy `reject_skill_proposal` **almost verbatim** (evals.py:991-1042) — it is ALREADY kind-agnostic. IDOR gate on `id AND user_id AND skill_id` (:1008-1017), 404-not-403, single `.update({"status":"rejected"})` (:1028-1035), NO version/skills write (pure audit, D-10/D-05). Reuse as-is; only the response hydration differs (`base_description` not `base_instructions`).

**Approve (`POST .../{proposal_id}/approve`) — DROP the async arm (D-07):**
The SI-01 approve (evals.py:1459+) INSERTs a `source='self_improve'` DRAFT version WITHOUT touching the live skill, then launches an async re-eval → `approved`/`re_evaling`. **SI-02 does the OPPOSITE and is much shorter:**
- Copy steps 1-2: owner-verify skill (evals.py:1483) + read proposal on `id AND user_id AND skill_id` (:1485-1494) + state guard `status == 'proposed'` else 409 (:1505-1510).
- **Then write the LIVE description** and let the 079/132 trigger version it (RESEARCH Code Examples :387-405):
  1. `UPDATE skills SET description = proposed_description WHERE id AND user_id` (fires `capture_skill_version`, source='manual'). Pattern: `skills.py:404-410` — **but wrap in `run_in_threadpool`** (skills.py's `update_skill` is a bare blocking call at :404; the route SI-02 writes must not repeat that — D-v2.5-01, RESEARCH Pitfall 5).
  2. Read back `SELECT id, version_number ... ORDER BY version_number DESC LIMIT 1` for `new_skill_version_id` — mirror the `_read_max_version` read (evals.py:1569-1578).
  3. `UPDATE skill_proposals SET new_skill_version_id=..., status='promoted'` (owner-scoped).
- **NO draft version INSERT, NO re-eval launch, NO `re_evaling`/`approved`/`interrupted`/`not_promoted` states, NO SSE** (D-04/D-07). Version-write mechanic: accept the trigger's `source='manual'` capture (RESEARCH Discretion #2 primary — the promoted proposal row is the audit anchor).

**Every supabase-py call `run_in_threadpool`-wrapped** (D-v2.5-01) — the analog wraps all of them (`_verify_owned_skill` :133, `_read_open` :797, etc.).

---

### `backend/app/api/skill_tuner.py` — optional winner-fetch helper (route/service, request-response)

**Analog:** `get_latest_tuner_run` (skill_tuner.py:817-873)

**What to copy (only if the propose route reads the winner via a shared helper):**
- The durable `tuner_runs` read (`.select("...scoreboard...").eq("skill_id").limit(1)`, :840-847), `run_in_threadpool`-wrapped (:850), 404 when no row (:858-863). Owner-or-global gate first via `_fetch_owned_or_global_skill` (:838). This is the read whose result feeds the honest-winner gate + the inline snapshot.

---

### `frontend/src/types/index.ts` — extend `SkillProposal` (type, self-extend)

**Analog:** self — `SkillProposal` (:764-788), `PromotionGate` (:749-758), `ProposalApproveResult` (:792-795)

**What to copy:**
- Add `kind: "instruction" | "description"`, `proposed_description: string | null`, `base_description: string | null`, `scoreboard_snapshot: DescriptionScoreboardSnapshot | null` — a DEDICATED type `{ winner: TunerCandidate; baseline: TunerCandidate | null; run_id: string }` matching what 139-02 writes (do NOT alias to `TunerScoreboard`, whose `candidates[]`/`winner_index` shape differs; reuse only the `TunerCandidate`/`TunerCell` members from `api.ts:3151-3175`), `source_tuner_run_id: string | null`. Keep the existing status union (:775-782) unchanged (description rows use a subset).
- Mirror the nullable idiom (`new_skill_version_id: string | null`, :768) and the doc-comment discipline (:760-763).

---

### `frontend/src/lib/api.ts` — `proposeDescription()` wire fn (utility, request-response)

**Analog:** `proposeImprovement` (api.ts:1876-1888), `approveProposal` (:1915-1926), `rejectProposal` (:1945-1956)

**What to copy:**
- The exact fetch shape: `getAuthHeaders()` → `fetch(`${API_BASE}/skills/${skillId}/description-proposals`, {method:"POST", headers, body})` → `if (!res.ok) throw await proposalError(...)` → `return res.json()`. Body is `ProposeDescriptionBody` carrying `{ run_id }` (the tuner run's `run_id`, NOT `source_eval_run_id`; the `source_tuner_run_id` provenance FK is derived server-side from `tuner_runs.id`) (mirror :1884).
- **Approve/reject REUSE the existing wires** (`approveProposal` :1915, `rejectProposal` :1945) — the routes share the path shape. Only note: the description approve returns a plain `SkillProposal` (no `re_eval_run_id`), so either add a description-specific `approveDescriptionProposal` returning `SkillProposal`, or branch on the response — planner's call. The reject wire (:1945-1956) is reusable as-is.

---

### ProposalCard description variant OR `DescriptionProposalCard` sibling (component, render-only)

**Analog:** `frontend/src/components/skills/studio/ProposalCard.tsx` (whole file :1-324) + `ProviderScoreboard.tsx` + `lineDiff.ts`

**What to copy:**
- **Render-only, handlers-injected contract** (ProposalCard.tsx:34-48) — NO `@/lib/api` call in the card; `onApprove`/`onReject`/`onPropose` are props (:43-47). For SI-02 drop `onRerun`/`onForcePromote`/`reEvalLive` (no async re-eval).
- **The diff render idiom** (ProposalCard.tsx:160, :171-190) — `lineDiff(proposal.base_description, proposal.proposed_description)` then `.map` rows to `add=emerald / remove=destructive / unchanged=foreground/70` spans. The description is short → a trivial small diff, no micro-dep (D-10; `lineDiff.ts:40-83`).
- **Honest status chip + text-node-only rendering** (ProposalCard.tsx:76-127, :26 "no raw-HTML injection sink"). SI-02 needs only `proposed → rejected | promoted` chips (subset of :76-115).
- **Action row** (ProposalCard.tsx:210-225): `proposed` → Approve + Reject buttons. Relabel "Approve & re-eval" (:213) → "Approve" (no re-eval). `promoted` branch (:273-281) → "Promoted to the live skill". DROP the `re_evaling`/`approved`/`not_promoted`/`interrupted` branches (:227-321).
- **Embed the scoreboard as PRE-approval evidence (D-04)** — render `<ProviderScoreboard cells={...} />` (ProviderScoreboard.tsx:88, cells-in pure render :43-47) from `proposal.scoreboard_snapshot`, proposed-vs-current head-to-head. This is the SI-02-specific addition the SI-01 card lacks.
- **Honesty lock** — never fabricate a diff; gate the whole card on an actionable (non-baseline) winner, mirroring `CandidateCard.tsx:52`.

RESEARCH Open Question 2 (139-RESEARCH.md:500-505): a thin `DescriptionProposalCard` sibling reusing `lineDiff` + `ProviderScoreboard` keeps SI-01's card honesty-locks untouched; either satisfies D-09. Planner's call.

---

### `frontend/src/pages/SkillTunerPage.tsx` — replace `handleConfirmWinner` (page, self-modify)

**Analog:** self — `handleConfirmWinner` (:461-467), CandidateCard wiring (:784-792), winner banner (:772-782)

**What to change (D-08 — additive; Deep/agent path untouched):**
- `handleConfirmWinner` (:461-467) currently does `await updateSkill(skillId, { description: candidate.description })` — a one-click `PATCH /skills` that lands a `source='manual'` version with NO audit row. **Repoint it** to call `proposeDescription(skillId, runId)` → open the description ProposalCard (diff + `ProviderScoreboard` evidence + Approve/Reject).
- The winner banner copy (:772-782) — the rewrite branch (:778-781) says "press Use to apply" → change to "Propose this description". The baseline branch (:772-776 "keeping it") is the honest-by-construction path (D-02) — keep it; it already refuses to offer an apply.
- `updateSkill` / `PATCH /skills/{id}` (skills.py:384) is NOT removed — manual description edits still use it (they still version via the 079 trigger).

---

### `frontend/src/components/skills/tuner/CandidateCard.tsx` — re-label affordance (component, self-modify)

**Analog:** self — `isActionableWinner` (:52), the "Use"/"★" button (:181-188), `onConfirm` prop (:26)

**What to change:**
- The `isActionableWinner` gate (:52 `isWinner && !candidate.is_baseline`) is the **reference honesty contract** — keep it. It already refuses "★ apply me" on the baseline description (D-02).
- Re-label the CTA (:181-188 "Use this →" / "Use") → **"Propose this description"**. The `onConfirm` handler (:26/:59) now triggers the propose flow, not a direct write. The diff-confirm strip (:128-176) can be removed (the ProposalCard now owns the review-diff surface) or repurposed — planner's call.

---

## Shared Patterns

### Owner-scoped 404-not-403 gate (V4 Access Control — primary)
**Source:** `evals.py:113-142` (`_verify_owned_skill`, owned-only) · `skill_tuner.py:177-206` (`_fetch_owned_or_global_skill`, owner-or-global)
**Apply to:** EVERY description route (propose/approve/reject) BEFORE any read/write.
- `get_supabase()` is service-role (RLS bypassed) → the app-code `.eq("user_id", …)` filter is the SOLE runtime gate; owner-only RLS SELECT (083:88-91) is defense-in-depth.
- 404 (never 403) on any owner miss; malformed UUID → 404 via try/except (never leak error shape — evals.py:134-138).
- Verify the proposal on `id AND user_id AND skill_id` before any write (IDOR — evals.py:1008-1017/:1485-1494).
- `user_id` from the auth token, `skill_id` from the path — NEVER the request body (T-135-02).

### `run_in_threadpool` on every supabase-py call (D-v2.5-01)
**Source:** `evals.py` (wraps all — :133, :797, :862) · `skill_tuner.py:619-626`
**Apply to:** All backend route DB reads/writes. **Note:** `skills.py:404` `update_skill` is a bare blocking call — the SI-02 approve route writes `skills.description` itself and MUST wrap it (do not copy skills.py's un-wrapped pattern).

### Service-role write + owner-only RLS (083 precedent)
**Source:** `supabase/migrations/083_skill_proposals.sql:22-27, :83-95`
**Apply to:** Migration 090 (no new write policy) + all route writes (service-role, app-code `.eq("user_id")` is the gate).

### Snapshot-not-FK for mutable upstream evidence (RESEARCH Pattern 1 / Pitfall 1)
**Source:** `skill_tuner.py:619-624` (`_persist_latest` upsert `on_conflict="skill_id"`) + `077_tuner_runs.sql:44` (`UNIQUE(skill_id)`)
**Apply to:** The propose route — copy `winner_description` + the proposed-vs-current scoreboard cells INLINE onto `skill_proposals.scoreboard_snapshot`; keep `source_tuner_run_id` FK as provenance only (`ON DELETE SET NULL`). A re-run would otherwise mutate a pending proposal's displayed evidence.

### Version-on-approval via the 079/132 trigger (zero-app-code, D-14 red line)
**Source:** `079_skill_versions_and_test_cases.sql:101-144` (`capture_skill_version` fires on `NEW.description IS DISTINCT FROM OLD.description` :113-116, INSERTs `source='manual'` :129-132) + append-only block :151-166
**Apply to:** The approve route — write ONLY `skills.description`; read back `MAX(version_number)` (evals.py:1569-1578 pattern) for `new_skill_version_id`. Do NOT also INSERT a version (double-capture — RESEARCH Pitfall 2). Do NOT retro-edit the version's `source` (append-only, 23514).

### Unified line diff render (D-10)
**Source:** `frontend/src/lib/lineDiff.ts:40-83` + `studio/ProposalCard.tsx:160, :171-190`
**Apply to:** The description ProposalCard variant — `lineDiff(base_description, proposed_description)` → red/green spans. No `diff`/`jsdiff` npm dep.

### Test harness: in-memory filtering Supabase fake (owner-scoping is MEANINGFUL, not vacuous)
**Source:** `tests/test_skill_proposals_router.py:37` reuses `_FilterSupabase`/`_override`/`_clear_overrides` from `test_evals_router` (honors `.eq()`/`.in_()`/insert/update/delete) · integration tuner tests reuse `_build_mock_supabase`/`_FakeRedis` (`test_skill_tuner_routes.py:33, :41`)
**Apply to:** `test_139_description_proposals.py` — reuse the same fakes so the 404 + pure-audit assertions are real.

---

## Pattern Assignments — Tests

### `backend/tests/integration/test_139_description_proposals.py`
**Analog:** `tests/test_skill_proposals_router.py` (`_seed` :45, `_patch_service` :121, `test_propose_owner_can_draft` :134, `test_cross_user_404` :172, `test_reject_is_pure_audit_via_route` :214)
**Mirror:** propose-creates-draft-no-live-write · baseline-wins-refuses-400 (honest-by-construction) · approve-writes-desc-and-version · reject-is-pure-audit (`new_skill_version_id` NULL) · cross-user 404 on all three. Seed a `tuner_runs` row with a scoreboard whose winner is non-baseline (adapt `_seed` :45-90 to add `tuner_runs` + drop the `eval_runs` source). Patch the service so no live provider is called (`_patch_service` :121 pattern).

### `frontend/src/components/skills/studio/DescriptionProposalCard.test.tsx`
**Analog:** `frontend/src/components/skills/studio/ProposalCard.test.tsx` (exists)
**Mirror:** baseline-winner → "nothing to propose" / no "Propose" affordance; rewrite-winner → "Propose this description"; approve/reject handlers fire the injected props; diff renders add/remove rows; scoreboard renders ≥2 provider cells. Note SEED-056 vitest rot — new tests must pass at HEAD.

---

## No Analog Found

| File | Role | Why no clean analog |
|------|------|---------------------|
| `backend/tests/test_139_migration_090.py` | test (DB-constraint) | No existing sibling test asserts a **kind-gated partial CHECK** against the live DB. The nearest is `tests/test_skill_proposals.py` (schema-level, not read this session) — worth checking for a DB-constraint-assertion style to mirror, but there is no direct analog for a partial-CHECK rejection test. **Requires migration 090 applied to the live local DB (psycopg2 :54322) before it can pass** — make "apply migration 090 to live DB" an explicit human-gated plan task before this test runs (RESEARCH :477-479). Test intent: a `kind='description'` insert with NULL `proposed_description` is rejected; `proposed_instructions` is now nullable. |

**Everything else has a strong in-repo analog** — this phase is composition, not construction.

---

## Metadata

**Analog search scope:** `supabase/migrations/`, `backend/app/api/{evals,skill_tuner,skills}.py`, `backend/app/services/skill_tuner_service.py`, `backend/app/models/eval_run.py`, `frontend/src/components/skills/{studio,tuner}/`, `frontend/src/pages/SkillTunerPage.tsx`, `frontend/src/lib/{api,lineDiff}.ts`, `frontend/src/types/index.ts`, `backend/tests/`
**Files scanned (read on disk this session):** 083, 079, 077 migrations; evals.py (5 ranges); skill_tuner.py (4 ranges); skill_tuner_service.py (winner/candidate); skills.py (update_skill); eval_run.py; ProposalCard.tsx; CandidateCard.tsx; ProviderScoreboard.tsx; SkillTunerPage.tsx (2 ranges); TriggeringTab.tsx; lineDiff.ts; api.ts (3 ranges); types/index.ts; test_skill_proposals_router.py + tuner test structure
**Migration number confirmed:** highest on disk is `089_skill_creator_file_attach_honesty.sql` → **090 is next** (CONTEXT.md's "087 latest" is stale)
**Pattern extraction date:** 2026-07-06
