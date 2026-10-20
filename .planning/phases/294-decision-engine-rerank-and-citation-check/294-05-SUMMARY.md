---
phase: 294-decision-engine-rerank-and-citation-check
plan: 05
subsystem: citations
tags: [citations, chat, ui, sketch-294-A, uat, g-4]
status: checkpoint-open  # Tasks 1-3 complete; Task 4 pass 1 recorded every row as blocked; the plan is NOT complete
requires:
  - phase: 294-02
    provides: measurement harness + 294-MEASUREMENT.md (openai_decisions UNMEASURED)
  - phase: 294-03
    provides: GET/POST /citation-checks, migration 211, citation-order-probe.py, shared fixtures
  - phase: 294-04
    provides: rerankEngines.ts engineFor(), RerankEngineBlock (sketch 294 B)
provides:
  - "lib/api/citationChecks.ts (own specifier, wire types verbatim, not in lib/api.ts)"
  - "stores/citationCheckStore.ts (microtask-batched ensure <=100 ids per GET, run, stable null, reset in setupTests)"
  - "components/chat/citationVerdicts.ts (VERDICT_META, verdictMeta, availabilityReason)"
  - "components/chat/CitationCheckAction.tsx (sketch 294 A action states in the References header)"
  - "verdict glyph + class + spoken verdict on CitedMarkdown markers; verdict section in CitationPeek"
  - "hot-file ledger + CLAUDE.md FIRING rows re-derived for the whole phase"
  - "294-VALIDATION.md: all 33 live rows recorded (pass 1: 33 blocked, with reasons and blocker ids)"
affects: [294 phase verification, 294 G-4 sign-off, deploy parity (migration 211)]
key-files:
  created:
    - frontend/src/lib/api/citationChecks.ts
    - frontend/src/stores/citationCheckStore.ts
    - frontend/src/components/chat/citationVerdicts.ts
    - frontend/src/components/chat/CitationCheckAction.tsx
  modified:
    - frontend/src/components/chat/CitedMarkdown.tsx
    - frontend/src/components/chat/CitationList.tsx
    - frontend/src/components/chat/CitationPeek.tsx
    - frontend/src/components/chat/MessageItem.tsx
    - frontend/src/index.css
    - frontend/src/setupTests.ts
    - frontend/src/landing/components/TourSection.tsx
    - frontend/src/landing/scenes/SettingsScene.tsx
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
    - scripts/vitest-count-gate.cjs
    - .planning/phases/294-decision-engine-rerank-and-citation-check/294-VALIDATION.md
key-decisions:
  - "294-05: the store loads the API client lazily so the setupTests import cannot defeat suites that mock lib/api/_core (measured: an eager import turned runEvidence.test.ts 3/3 red)"
  - "294-05: the CSS fence reads index.css through node:fs (?raw is '' under vitest, measured)"
  - "294-05 Task 4 pass 1: no live row was driven; every row records ⛔ with a blocker id, and the plan stays open at its checkpoint rather than being ticked"
requirements-completed: []  # DEC-01/02/03 stay Pending until the live drive and G-4 sign-off land
completed: null
---

# Phase 294 Plan 05: Citation verdicts on the marker, ledger re-derivation, live drive (pass 1 blocked) Summary

**The chat shows the citation verdict on the marker the reader already knows (sketch 294 A). The check action sits in the References header and stored checks load through one batched GET per view. The hot-file ledger is re-derived for the whole phase. The live drive (Task 4) did not run in pass 1: all 33 rows are recorded as ⛔ with reasons, and the plan stays open at its checkpoint.**

## Task commits

| Task | Commit | Message |
|---|---|---|
| 1 RED | `b259c2434` | test(294-05): add failing tests for the citation-check client, store, vocabulary and action |
| 1 GREEN | `3bb0cc0d0` | feat(294-05): citation-check client, store, vocabulary and References-header action |
| 2 RED | `a2d2cb37f` | test(294-05): add failing tests for verdict marks and the peek verdict |
| 2 GREEN | `2ccda5604` | feat(294-05): citation verdicts on the marker and in the peek |
| 2 follow-up (Rule 1) | `9dbe53540` | fix(294-05): landing copy names the four reranking engines and the citation check |
| 3 | `9ea78fdb8` | docs(294-05): re-derive the hot-file ledger and FIRING rows for phase 294 |
| checkpoint handback | `327d2d868` | docs(294-05): record Tasks 1-3 committed; Task 4 live drive at its checkpoint |
| 4 pass 1 | (this commit) | docs(294-05): record live-drive pass 1 (all rows blocked) and the plan summary |

## Tasks 1-3 (from the commits)

- **Client** (`lib/api/citationChecks.ts`). It is imported by its own path and is not re-exported from `lib/api.ts`. The wire types are copied verbatim from `backend/app/models/citation_check.py`. `CitationCheckApiError` carries the 409 `reason`.
- **Store** (`stores/citationCheckStore.ts`). `ensure` batches all ids requested in one microtask into GETs of at most 100 ids. `run` POSTs a check, and `useCitationCheck` returns a stable `null` when nothing is stored. The store is its own module, not part of `streamsStore.ts`. `resetCitationChecks` is registered in `setupTests.ts`.
- **Vocabulary** (`citationVerdicts.ts`). `VERDICT_META` holds sketch 294 A's glyphs, words and fixed reason lines. Lookups use an own-property guard, so an unknown verdict maps to couldn't check. The file also holds the three D-16 reason lines.
- **Action** (`CitationCheckAction.tsx`). It covers every sketch 294 A state: button, checking, count pills + Re-check, the "checked by" line, the ⓘ reason lines, and a one-line error.
- **Markers** (`CitedMarkdown.tsx`). Every marker carries `data-citation-ordinal`. A marker is decorated only when the claim's `n` matches the marker's `n` (T-294-26). The decoration is re-applied after every innerHTML rebuild and applied in place when a result arrives, so hover listeners stay attached.
- **Peek** (`CitationPeek.tsx`). It gains an optional verdict section: the verdict word, the raw confidence to 2 decimals, and the fixed reason.
- **References footer** (`CitationList.tsx`). It mounts exactly one `CitationCheckAction`, beside the fold trigger.
- **MessageItem.** `checkMessageId` is passed on the two existing citation mounts (+2 / -1 lines). It keeps useState 3, useEffect 0 and its 5 props.
- **CSS** (`index.css`). One block, keyed only on the `citation-marker--v-*` / `__verdict` classes.
- **Ledger** (Task 3).
  - 34 scan-list rows re-derived, and one row added (`scripts/check-deploy-drift.sh`).
  - CLAUDE.md FIRING table: 9 rows updated, 4 added.
  - Six plan-05 suites, plus 294-04's two suites, adopted into the vitest count gate.
- **Gates at Task 3.** CLAUDE.md size OK (about 96.4k chars), hot-file ledger OK, seeds register OK. The backend failing set equals the base set (70). Vitest: 0 per-file decreases and 1 red, a SEED-171 canvas flake (the file is byte-unchanged, and it passed 3/3 when run alone).

## Task 4: live drive, pass 1 (2026-10-20)

**Tally: 0 PASS · 0 FAIL · 33 ⛔ · 0 pending.** Rows are recorded in `294-VALIDATION.md` under "Drive pass 1". No defect was found, because no row was driven.

### Why nothing was driven

| Blocker | Exact text |
|---|---|
| `BLK-294-05-T1`: this agent had no browser tools. The claude-in-chrome tools and the tool loader were not exposed. | `Error: No such tool available: ToolSearch. ToolSearch is not among the tools available here.` |
| `BLK-294-05-P1`: the auto-mode classifier denied (1) minting a local dev-user session for API calls, (2) the M1 / E3 re-probe through `measure-decision-engines.py`, and (3) a read-only local-DB query that followed. | (1) and (3): `Reason: [Credential Materialization]`. (2): `Reason: [Credential Exploration]` |
| `BLK-294-05-F`: the fault path is inactive, and this pass was told not to edit .env or restart. | `backend.33864.log` line 2: `API docs: OPEN (ENVIRONMENT='')`; 0 `is ACTIVE` lines |
| Vendor, last-known from 294-02 and NOT re-probed | OpenAI `gpt-6-luna`: HTTP 403 *"The project does not have access to this model."*. LangSmith: `403 Forbidden` on `runs/multipart` |

### Measured read-only in pass 1

- `apply_migration_211.py --verify-only`: `VERIFY: 12/12 PASS` on both runs.
- Without a token, `GET` and `POST` `/citation-checks` return 403. `/openapi.json` lists both paths. `/health` returns 200 and the frontend on :5173 returns 200.
- The live backend runs a single worker (pid 33864), and its log has no rerank or decision activity.
- Roster derived from `MODEL_CAPABILITIES`, one model per provider:
  - OpenAI `gpt-5.6-terra`
  - Anthropic `claude-sonnet-5`
  - Google `gemini-3.5-flash`
  - DeepSeek `deepseek-v4-pro`
  - Zhipu `glm-5.2`
  - MiniMax `MiniMax-M3`
  - Moonshot `kimi-k2.6`
  - OpenRouter `deepseek/deepseek-v4-pro`
- **OpenRouter key.** The local `app_settings.openrouter_api_key` column has length 0. The loader (`_val`, `user_settings.py:880-892`) falls back to the `backend/.env` value when the column is NULL. Whether the column is NULL or `''` was not readable after the denial, so the key the chat path sees is unknown. 294-02's preflight did resolve an OpenRouter key through the same loader.

### Rows

| ID | Result | Evidence pointer |
|---|---|---|
| E1 | ⛔ T1 + P1 | backend.33864.log: 0 rerank lines, one worker; last-known load times in 294-MEASUREMENT.md |
| E2 | ⛔ T1 + P1 (+ LangSmith 403 last-known) | 294-measurement.json (jev arm, 294-02) |
| E3 | ⛔ T1 + P1 + vendor 403 (re-probe denied) | 294-MEASUREMENT.md openai_decisions row |
| E4 | ⛔ T1 + P1 | app_settings `rerank_enabled=false`; 0 decision lines in the live log |
| E5 | ⛔ LangSmith 403 last-known + P1 | test_294_no_key_egress.py (automated cover) |
| F1 | ⛔ F | backend.33864.log line 2 `ENVIRONMENT=''`, 0 `is ACTIVE` |
| F2 | ⛔ F | same log lines as F1 |
| F3 | ⛔ F | fault server not started (override not honoured) |
| F4 | ⛔ F + P1 | same log lines as F1 |
| F5 | ⛔ F | same log lines as F1 |
| R1-R8 | ⛔ T1 + P1 (R2 also the Anthropic billing block, last-known) | Model column filled from MODEL_CAPABILITIES; key-column presence per row |
| A1 | ⛔ T1 + P1 | none (needs a session) |
| A2 | ⛔ T1 + P1 | none |
| A3 | ⛔ T1 + P1 | none |
| C1 | ⛔ T1 + P1 | migration 211 VERIFY 12/12 PASS; routes 403 unauthenticated; openapi paths |
| C2 | ⛔ depends on C1 | none |
| C3 | ⛔ T1 + P1 | none |
| C4 | ⛔ T1 + P1 | automated cover named in row |
| C5 | ⛔ T1 | live row rerank off + cohere (expected ⓘ line noted) |
| C6 | ⛔ T1 + P1 + vendor 403 | 294-MEASUREMENT.md |
| C7 | ⛔ no exit code (probe not run) | needs a C1 message id + engine keys |
| S1 | ⛔ T1 + P1 | none |
| M1 | ⛔ P1 (re-run denied); 294-MEASUREMENT.md unchanged | denial text above |
| G4-1 | ⛔ evidence not captured (T1) | note on the env-key fallback for the re-drive |
| G4-2 | ⛔ evidence not captured (T1 + P1) | none |
| G4-3 | ⛔ evidence not captured (T1) | none |

### Settings: read, never written

`app_settings` (`id='global'`), read once at about 05:43 local and never written by this agent: `hybrid_search_enabled=true`, `hybrid_candidate_count=20`, `rerank_enabled=false`, `rerank_provider='cohere'`, `rerank_model='rerank-v3.5'`, `rerank_top_n=5`, `retrieval_top_k=5`, `updated_at=2026-10-18 17:35:04.782645+00`. Precondition 6 was not applied, so there was nothing to restore. No key was read or printed.

## Owed to operator

1. **Re-run Task 4** in a session that exposes the claude-in-chrome tools and lets the agent use the local dev user's session, or have the operator drive the browser rows. Every row's steps are unchanged in `294-VALIDATION.md`.
2. **Fault phase F1-F5.**
   - Start `scripts/decision-fault-server.py --port 8765 --slow-seconds 12`.
   - Add `ENVIRONMENT=local` and `DECISION_ENGINE_FAULT_BASE_URL=http://127.0.0.1:8765` to backend/.env, then restart the backend once.
   - Confirm the single `is ACTIVE` warning, drive the modes, then remove both lines and restart once more.
3. **OpenAI Decisions.** Enable `gpt-6-luna` for the OpenAI project, or store a key that has access. Then run M1 (`--arms off,openai_decisions`), E3, C6 and C7-on-OpenAI.
4. **LangSmith.** Supply a key that LangSmith accepts (uploads were last 403). E2, E3 and E5 need it.
5. **OpenRouter key into Settings** if it is only in backend/.env. The DB column has length 0, and G4-1 needs a known no-key state anyway.
6. **G-4 sign-off** for G4-1..G4-3, against sketches 294 B and 294 A, after the re-drive captures the evidence.
7. `bash scripts/regenerate-full-schema.sh` (needs docker), then `node scripts/check-schema-acl-parity.cjs` green.
8. **Production.** Paste `supabase/migrations/211_message_citation_checks.sql` into the cloud SQL editor before the backend deploys, run its VERIFY block, then run `get_advisors(security)` (approval-gated).
9. **Anthropic billing** (R2), if it is still blocked.

## Deviations from Plan

- **Task 4 not driven.** The driving agent lacked the browser tools the plan assumes, and the permission classifier denied the session and credential-bearing runs. Rows were recorded ⛔ with reasons, as the plan allows, and were never omitted. The plan's checkpoint acceptance is NOT met: C1 does not read contradicted, C7 has no exit code, and the operator has not approved. So **294-05 is not ticked in ROADMAP.md**.
- **Settings precondition 6 was not applied.** Nothing was driven that needed it, so the operator's settings were never touched.

## Self-Check

- Commits present: `b259c2434`, `3bb0cc0d0`, `a2d2cb37f`, `2ccda5604`, `9dbe53540`, `9ea78fdb8`, `327d2d868`. See the git log check in the handback.
- `grep -c "| pending" 294-VALIDATION.md` = 0.
