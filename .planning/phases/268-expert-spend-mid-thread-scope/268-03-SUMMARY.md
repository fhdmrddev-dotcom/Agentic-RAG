---
phase: 268-expert-spend-mid-thread-scope
plan: 03
subsystem: chat scope (api + transcript + composer)
tags: [CHAT-08, SEED-286, scope_changed, ScopeEffect, transcript-event, audit, composer, experts]

requires:
  - phase: 267
    provides: TRANSCRIPT_EVENT_KINDS allowlist + _reconstruct_history skip + MessageItem early return; describe_expert_scope / build_expert_changed_event; the ExpertEventCard Shell; ScopeLedger; the rename_thread Expert arm shape
  - phase: 268-01
    provides: send_message resolves scoping once; the run's org/Expert stamps (unchanged here)
  - phase: 268-02
    provides: expertThemeContrast.test.tsx with HUES += indigo and PAIR_FLOOR 38
provides:
  - scope_changed transcript kind (backend + frontend mirror, ?raw cross-pinned), skipped for the model
  - ScopeEffect payload + GET /threads/{id}/scope-effect (at rest / draft / clear) resolved with the active org + caller role
  - PATCH /threads/{id} folder arm (folder_id / clear_folder) — authorized within the thread's org, one-txn event, no 409 while streaming
  - search.query audit rows carry run_id / thread_id / parent_run_id / folder_ids (both arms)
  - composer ScopeChip + ScopePicker + ChatArea.applyScopeChange (the one scope PATCH home) + the pending note
affects: [268-04 live proof (G4-2 / G4-3, the audit join), registers (hot-file ledger rows owed by 268-04)]

tech-stack:
  added: []
  patterns:
    - "Pitfall 11: a new field on a shared wire ref goes on a SUBCLASS whose type is DECLARED on the new models' fields (Pydantic v2 serializes by declared type)"
    - "One payload, three renderings: chip `held`, picker ledger, snapshotted card — `held` decided on the server"
    - "Radix menu content: every control is a menu item (Radix traps Tab)"
    - "An API call made inside `new Promise(resolve => resolve(call()))` so a mock with a missing export is a rejection, never a mount crash"

key-files:
  created:
    - backend/tests/unit/test_268_scope_effect.py
    - backend/tests/unit/test_268_scope_patch.py
    - backend/tests/unit/test_268_search_audit_keys.py
    - backend/tests/fixtures/phase268/scope_changed.json
    - backend/tests/fixtures/phase268/scope_changed_held.json
    - backend/tests/fixtures/phase268/scope_changed_during_run.json
    - frontend/src/components/chat/scopeCopy.ts
    - frontend/src/components/chat/ScopeChip.tsx
    - frontend/src/components/chat/ScopePicker.tsx
    - frontend/src/components/chat/__tests__/scopeCopy.test.ts
    - frontend/src/components/chat/__tests__/ScopeChip.test.tsx
    - frontend/src/components/chat/__tests__/ScopePicker.test.tsx
    - frontend/src/components/chat/__tests__/ChatArea.scopeChange.test.tsx
  modified:
    - backend/app/models/message.py
    - backend/app/models/thread.py
    - backend/app/services/expert_scope.py
    - backend/app/api/threads.py
    - backend/app/services/tool_dispatcher.py
    - backend/tests/unit/test_267_transcript_kinds.py
    - frontend/src/lib/api/threads.ts
    - frontend/src/lib/api.ts
    - frontend/src/components/chat/expertEventCopy.ts
    - frontend/src/components/chat/ExpertEventCard.tsx
    - frontend/src/components/chat/ActiveExpertChip.tsx
    - frontend/src/components/experts/ScopeLedger.tsx
    - frontend/src/components/chat/MessageInput.tsx
    - frontend/src/components/chat/ChatArea.tsx
    - frontend/src/components/chat/__tests__/expertEventCopy.test.ts
    - frontend/src/components/chat/__tests__/ExpertEventCard.test.tsx
    - frontend/src/components/chat/__tests__/expertThemeContrast.test.tsx
    - frontend/src/components/experts/__tests__/ScopeLedger.test.tsx
    - scripts/vitest-count-gate.cjs

key-decisions:
  - "268-03: D-268-12a shipped as ALLOWED — no 409 while streaming or cap_paused on a scope change; during_run is snapshotted and the pending note is the live receipt (the §5.3 409 branch was NOT built)"
  - "268-03: describe_scope_change states BOTH sides with allow_unresolved=True (the Expert is the same on both sides of a folder change); an Expert that no longer exists at all falls back to stating the thread alone rather than blocking the change"
  - "268-03: the folder PATCH authorizes via fetch_visible_folders(restrict_org_ids={thread.org_id}) AND the folder row's own org == thread org; an org-less thread fails closed (restrict set())"
  - "268-03: ScopeEffect / the scope event resolve with resolve_active_org_or_none only (no thread-org fallback) — the producer's exact input (Pitfall 9)"
  - "268-03: the picker reads the SAVED folder at rest (no draft param), so a folder the caller can no longer see still states itself instead of 404ing"

requirements-completed: [CHAT-08]

duration: ~1h
completed: 2026-09-28
---

# Phase 268 Plan 03: Mid-thread scope change Summary

**A live thread's folder scope can now be changed from a composer chip whose picker states the server's `ScopeEffect` before Apply; one PATCH authorizes the folder within the thread's org and writes a `scope_changed` transcript row (never sent to a model) in the same transaction; the chip, the picker ledger and the card all render from one payload in which `held` is decided by the server; and every `search.query` audit row now carries the run it belongs to.**

## Wave-1 merged gate (before any edit)

Run in this worktree at `c99256165` (the wave-1 merge commit), bootstrapped:

```
Summary:        71 failed, 5904 passed, 1 skipped, 2 xfailed, 2 xpassed, 47 warnings in 341.24s (0:05:41)
[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0).
```
Failed SET diffed against `268-BASELINES.md`: **identical** (the only diff line was a stderr path glued to one id — the same
transcription artefact 268-01 recorded; the id is the same). No new name to classify.

tsc (`-p tsconfig.app.json --noEmit`) error SET at this plan's base: **70 errors** (captured to the executor scratchpad).

## What was built

| Task | Commits | What |
|---|---|---|
| 1 | `3cd1a74cf` test → `fdeed7368` feat | `scope_changed` kind; `ScopeFolderRef`/`ScopeTranscriptLine`/`ScopeChangedEvent`/`ScopeEffect`; `_dropped_line` extracted; `folder_path`, `build_scope_effect`, `build_scope_changed_event`, `scope_event_sentence`, `describe_scope_change`; the PATCH folder arm + `_write_scope_change` + `GET /threads/{id}/scope-effect`; the audit keys; the frontend allowlist line |
| 2 | `b7d0830ff` test → `d6f8fd7e1` feat | `setThreadFolder` / `getScopeEffect` + four wire types (re-exported from `lib/api.ts`); `SCOPE_EVENT_COPY` / `scopeEventModel`; the card's tone lookup + `ScopeChangedCard`; `scopeCopy.ts` |
| 3 | `cb7981b7b` test → `3f6607a88` feat | `ScopeChip` (S1-S5), `ScopePicker` (P1-P4, latest-wins, menu items), `ScopeLedger` held tone/tag/muted, `ActiveExpertChip` paired, `MessageInput` two optional slots, `ChatArea.applyScopeChange` + at-rest read + pending note, header pill removed |

## RED outputs (quoted, before implementation)

- **Task 1** (backend): `45 failed, 9 passed` — `ImportError: cannot import name 'build_scope_effect' / 'build_scope_changed_event' / 'scope_event_sentence' / 'ScopeFolderRef'`, `AttributeError: … does not have the attribute 'describe_scope_change'`, `Failed: DID NOT RAISE <HTTPException>` (×6: the folder arm did not exist, so no 404/422), `KeyError: 'run_id' / 'parent_run_id' / 'folder_ids'`, and the allowlist asserting three kinds. The 9 that passed at base are 267's own transcript-kind cases plus two guards whose base behaviour IS the contract (a same-folder no-op writes nothing; another user's thread 404s).
- **Task 2** (frontend): `Tests 10 failed | 30 passed (40)` and `scopeCopy.test.ts` failed to import (`../scopeCopy` did not exist).
- **Task 3** (frontend): `ScopeChip.test.tsx`, `ScopePicker.test.tsx`, `expertThemeContrast.test.tsx` failed to import; `Tests 10 failed | 10 passed (20)` in the rest (every ChatArea case but the new-chat `<select>` one — which is base behaviour — and both new ScopeLedger cases).

## Gate verdicts (verbatim, end of plan)

**Backend** (`node scripts/check-backend-unit-baseline.cjs`):
```
Summary:        71 failed, 5950 passed, 1 skipped, 2 xfailed, 2 xpassed, 47 warnings in 312.52s (0:05:12)
[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0).
```
Failed SET vs `268-BASELINES.md`: **identical** (NEW = [] · GONE = []). `+46` passed = this plan's new backend cases.

**Vitest count gate** (repo root, `GSD_VITEST_MAX_WORKERS=2`, first and only full run):
```
  total                                      8341    9089    +748
  total 9089  ·  failed 4  ·  pinned total 8341
RESULT: COUNT GATE VIOLATED (1 reason(s))
  FAIL  [failing-tests] 4 test(s) failed — the gate requires 0.
```
The four, named from the gate's own persisted JSON **before any re-run**:
- `src/components/library/__tests__/sketchComposition.test.tsx` ×2 (`STACK_TRACE_ERROR`; "Found multiple elements with the role tab …") — **the inherited red frozen in `268-BASELINES.md`**, same two cases.
- `src/pages/WorkflowBuilderPage.canvas.test.tsx` ×2 (`STACK_TRACE_ERROR`; `AssertionError: expected 0 to be greater than 0` on its POSITIVE CONTROL) — **SEED-171's fifth named flaky suite, with its recorded signature**. `git diff --numstat c99256165 HEAD -- frontend/src/pages/ frontend/src/components/workflows/ frontend/src/components/library/` is EMPTY — provably unmodified. Re-run in isolation afterwards as an observation: `154 passed (154)`. One green sample proves nothing; it is recorded, not claimed.

No per-file decrease; this plan's pins read exactly: `expertEventCopy.test.ts 26` · `ScopePicker.test.tsx 15` · `ExpertEventCard.test.tsx 14` · `expertThemeContrast.test.tsx 13` · `scopeCopy.test.ts 13` · `ScopeLedger.test.tsx 11` · `ChatArea.scopeChange.test.tsx 9` · `ScopeChip.test.tsx 7`.

**tsc** (`-p tsconfig.app.json --noEmit`): 70 → 70. SET diff adds nothing — the only moved entries are `src/lib/api.ts:254/255` → `:260/261` (the same two pre-existing errors, shifted 6 lines by the new re-exports).

**Hot-file ledger**: `ledger gate OK — every watched file has a row.`

**Targeted suites** — backend Task-1 verify list + `test_2171_search_error_audit.py` + `test_retrieval_failure_honesty.py`: `163 passed`. Frontend Task-3 verify list (15 files incl. `ChatArea.expertThread`, `src/components/experts`, `MessageInput.connectors`): `228 passed`.

## Acceptance checks

- `git diff c99256165 -- backend/tests/unit/test_267_expert_changed_event.py backend/tests/fixtures/phase267/` → empty; that suite green (267's byte-equality held through the `_dropped_line` extraction).
- `path` appears in `message.py` only on `ScopeFolderRef` (asserted by `test_the_267_ref_models_are_unchanged_path_lives_on_the_subclass_only`).
- No `HTTP_409` in `_apply_folder_change` (asserted by `test_the_folder_arm_region_raises_no_409`).
- `"run_id": str(ctx.run_id)` → 2 matches in `tool_dispatcher.py` (asserted); `test_259_closed_core_inventory.py` green (29 tools).
- `grep -c scope_mode ScopeChip.tsx ScopePicker.tsx` → `0` and `0`; the `?raw` fence (comments stripped) is green. `ExpertEventCard.tsx` scope_mode count 0 → 0.
- The bare-50-400 hue grep over `ScopeChip`/`ScopePicker`/`ActiveExpertChip` returns no line without `dark:`.
- `git diff c99256165 -- frontend/src/components/chat/MessageItem.tsx backend/app/services/retrieval_service.py` → **empty**.
- `MessageInput.tsx` hooks (grep counts, import line included): useState **8 → 8**, useEffect **6 → 6**, useCallback **4 → 4**.
- `setThreadFolder` and `getScopeEffect` both re-exported from `lib/api.ts`; the three new suites and `scopeCopy.test.ts` sit in BOTH count-gate knobs.

## G-5 — honoured by construction on the firing files

- `backend/app/api/threads.py`: **+1 arm** (the folder dispatch at the top of `rename_thread`, which returns before the Expert arm — the Expert arm's statement order is untouched and `test_267_expert_changed_event.py` stays green), **+1 writer** (`_write_scope_change`), **+1 route** (`GET /{thread_id}/scope-effect`), plus three small helpers the arm and route share (`_read_thread_scope`, `_authorize_thread_folder`, `_describe_thread_scope_change`). **0 new branches in the send path.**
- `backend/app/services/tool_dispatcher.py`: additive audit metadata keys only, in the two existing dicts. The registry/handler seam stays OWED.
- `backend/app/models/thread.py` / `message.py`: additive fields/models only; 267 dumps byte-identical.
- `frontend/src/components/chat/MessageInput.tsx`: +2 optional `ReactNode` props; hooks unchanged (above).
- `frontend/src/components/chat/ChatArea.tsx`: +1 PATCH callback (`applyScopeChange`) beside the Expert one, +1 read callback; the header folder pill REMOVED. Measured hook deltas, stated rather than hidden: `useState` 5 → 7 (`scopeEffect`, `scopePendingNote`), `useEffect` 4 → 6 (the at-rest read; the pending-note clear), `useCallback` 10 → 12, `useRef` 1 → 2.
- `frontend/src/lib/api.ts`: two barrel names + four type names.
- **G-5 not fired on `retrieval_service.py`: file unmodified; SEED-224 extraction stays owed.** `MessageItem.tsx` not edited (UI-SPEC §9-R3 confirmed: its one early return already routes the new kind).

## D-268-02 carried risk

267's event plumbing is unchanged since `5240711b1` except 268-01's four org stamps in `agent_loop.py` (no plumbing change). `267-REVIEW.md` (`status: fixed`) records an INFO suggestion to move `transcript_kind(row)` next to the allowlist; not done in 267 and not needed here — `scope_changed` follows the shipped shape (`tool_calls[0].kind`), and both the skip and the visible-rows helper are pinned for the new kind in `test_267_transcript_kinds.py`.

## Deviations from Plan

### Auto-fixed / adapted

**1. [Rule 2 - Correctness] `describe_scope_change` states the AFTER side with `allow_unresolved=True` too**
- The plan named it only for the before side. On a folder change the Expert is the same on both sides, so an Expert whose access has gone would otherwise 404 the whole folder change. It is stated as reading nothing (the run refuses such an Expert anyway, fail-closed); an Expert that no longer exists at all (`LookupError`) falls back to stating the thread alone with a warning. Pinned by `test_an_unresolvable_expert_falls_back_to_the_thread_alone_rather_than_blocking`.

**2. [Rule 2 - Correctness] The picker's first preview is the AT-REST read, not `?folder_id=<saved>`**
- A saved folder the caller can no longer see would 404 the draft authorization and show P4 on open. Reading at rest states it truthfully (S4 label, the server's effect).

**3. [Rule 3 - Blocking] ChatArea's scope read is made inside a promise chain**
- Several shipped ChatArea suites mock `@/lib/api` without `importActual`; touching an undeclared export throws. `new Promise(resolve => resolve(getScopeEffect(tid)))` turns that into a caught rejection, so no suite outside this plan needed its mock edited. `ChatArea.expertThread.test.tsx` was NOT edited (it did not throw at mount).

**4. [Rule 2 - Correctness] `ScopeLedger` gained `tag` and `muted` item fields beside the `held` tone**
- The plan named the held tone; the `Expert` tag (UI-SPEC P2) and the muted `Nothing changes` literal have no other home in the one ledger leaf. Additive, optional; pinned by two new `ScopeLedger.test.tsx` cases (its pin re-set 9 → 11 as the plan asked).

**5. [Rule 1 - Bug, own tests] Two test-harness bugs fixed before GREEN**
- `scopeCopy.test.ts` reused one `Response` across fetch calls ("Body has already been read"); `ScopePicker.test.tsx` case 1 never mounted the chip. Both were in this plan's own new tests; fixed in the feat commits and named in their messages.

**6. [UI-SPEC §5.2 detail] The chip carries `title` = its accessible name** (the full path); the header of the scope card truncates with its full text in `title`. `title` is never the only copy (the visible label and suffix carry the meaning).

### Not built (by design)

- The §5.3 "409 branch" (`Wait for this answer to finish…`) — research refuted the premise (D-268-12a ALLOWED), so the streaming sub-line and the §5.4 pending note shipped instead.

## Known Stubs

None. The chip, picker and card render from the server's `ScopeEffect` / `scope_changed` payload; no hard-coded data.

## Threat Flags

None beyond the plan's register. T-268-20 (folder authorized within the thread's org + folder-row org check, 404 before any write — two unit cases), T-268-21 (scope-effect: ownership 404 before any read, draft authorized identically), T-268-22 (`scope_changed` skipped by `_reconstruct_history` — unit case), T-268-23 (one user-JWT txn, 500 literal, rollback — unit case), T-268-24 (event `org_id` = the THREAD's org, asserted against a different active org), T-268-25 (active org + caller role — unit case), T-268-26 (React text children only) are each implemented and pinned.

## Owed / for 268-04

- Live proof: G4-2 (card after reload + the audit join `run_id → document_ids → documents.folder_id ⊆ ScopeEffect.next`, Pitfall 10) and G4-3 (Restricted, both themes) in Chrome; the SC#10 board.
- Registers: CLAUDE.md / `docs/HOT-FILE-LEDGER.md` rows for `threads.py`, `tool_dispatcher.py`, `models/thread.py`, `models/message.py`, `MessageInput.tsx`, `ChatArea.tsx`, `expert_scope.py`, `ExpertEventCard.tsx`, `expertEventCopy.ts`, `ScopeLedger.tsx`, `ActiveExpertChip.tsx`, `lib/api/threads.ts`, `vitest-count-gate.cjs` and the three new leaves are now stale by this plan's commits — not edited here (not in `files_modified`).
- `graphify update .` not run from the worktree (it rewrites tracked `graphify-out/` files; the orchestrator can run it after merge).

## Self-Check: PASSED

- Created files present: the 3 backend test files, 3 fixtures, `scopeCopy.ts`, `ScopeChip.tsx`, `ScopePicker.tsx` and the 4 new frontend suites.
- Commits present in `git log`: `3cd1a74cf`, `fdeed7368`, `b7d0830ff`, `d6f8fd7e1`, `cb7981b7b`, `3f6607a88`.
