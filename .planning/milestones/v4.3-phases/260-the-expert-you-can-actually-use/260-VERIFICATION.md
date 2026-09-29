---
phase: 260-the-expert-you-can-actually-use
verified: 2026-09-23
verification_mode: independent
verifier: Claude (gsd-verifier) — did not build or review this phase
head_verified: c6e29b42e (develop)
status: gaps_found   # was gaps_found at independent verification; see the addendum at the end
score: 2/3 success criteria verified (PACK-02 satisfied, PACK-03 satisfied, PACK-05 unsatisfied)
overrides_applied: 0
gaps:
  - truth: "SC#3 / PACK-05 — the Financial Analyzer ships end to end: selectable, scoped, prompted, and answering FROM THE DOCUMENTS or refusing, driven as a real conversation against real documents, not a fixture"
    status: failed
    reason: >
      No real user can reach the Financial Analyzer's documents, so it has never answered from them.
      Migration 188 put the folder, the 10-K and its chunks in org 430bffc6-7275-499b-b307-d932b4750051,
      a hardcoded UUID. That org is "seed@system.local's Organization" and its only member is
      seed@system.local. In the local DB the 10-K reads status='failed', and both of its chunks have
      embedding IS NULL. Every recorded Financial Analyzer conversation in the local DB (threads
      619cdee6, 22c52c89, ec2e49e9) ends with the agent saying there is no 10-K, or no documents at all.
      The "live conversation proof" test_260_financial_analyzer_conversation.py is a fixture: it mocks
      search_documents and asserts on assistant answers that the test itself hardcodes.
    artifacts:
      - path: "supabase/migrations/188_expert_chat_scoping.sql"
        issue: "folder / document / chunks / skill seeded with org_id hardcoded to local dev org 430bffc6 (lines 31, 61, 120, 129, 153); chunks inserted without embeddings; document ends up status 'failed'. On production the same UUID names no real org."
      - path: "backend/tests/unit/test_260_financial_analyzer_conversation.py"
        issue: "turn1_answer / turn2_answer / refusal_response (lines ~96-101, ~155-162, ~186-193) are string literals written by the test and asserted against themselves; search is mocked. Proves the dispatcher passes folder_ids, not that the Expert answers."
    missing:
      - "Seed the Financial Analyzer's knowledge so a real caller in ANY org can retrieve it (a system-scoped folder the retrieval path honours cross-org, or per-org provisioning at tier grant), with real embeddings and a document in a terminal-success status"
      - "One recorded live conversation, run as a real user in a real org, where a tile prompt returns an answer citing acme_q3_2026_financial_report.md (e.g. $124.5M / +18.2%), plus one out-of-scope question that is refused"
      - "Replace the tautological assertions in test_260_financial_analyzer_conversation.py (or relabel it as dispatcher wiring, not PACK-05 proof)"
deferred: []
human_verification: []
---

# Phase 260: The Expert You Can Actually Use — Verification Report

**Phase Goal:** Selecting an Expert in a chat thread **visibly scopes that thread** and tells a new user what to ask. One first-party Expert proves the whole slice end to end.
**Verified:** 2026-09-23, independently, against `develop` HEAD `c6e29b42e`. This includes the folder-wall follow-ups `e783a30f9` and `ad093fd4a`.
**Status:** gaps_found
**Re-verification:** No. This is the first `VERIFICATION.md` for 260; the phase was closed on `260-REVIEW.md` alone.

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Selecting an Expert **scopes that thread**: skills, connections and knowledge match the bundle, the thread states which Expert is active, and the scoping is legible in the chat (PACK-02) | ✓ VERIFIED | **Persistence:** `threads.active_expert_id` (mig 188 l.7-8). **Resolution as data:** `run_producer._resolve_thread_scoping` (`run_producer.py:378-526`) returns folders, tools, skills, path and bundle id, and both producer call sites pass them into `RunContext` (`:681/697-698`, `:854/872-873`). **Consumed with no Expert branch:** `agent_loop.py:1397-1398` (folders), `:1445-1462` (skill catalog), `:1697-1698` (tools); `grep -ci expert agent_loop.py` = **0**. **Review F-1 fail-closed fix confirmed in code:** an unresolvable bundle resets the id to NULL and raises (`:430-442`), and any other exception re-raises (`:519-526`). The old "falling back to unrestricted" path is gone. **Review F-3 confirmed:** `EXPERT_CORE_TOOLS` at `tool_dispatcher.py:4746`, subset-asserted at `:4759`. **Legible:** `ActiveExpertChip` is mounted in the existing chips row (`MessageInput.tsx:504-511`), with the violet frame at `:486`. **Folder wall now covers every file tool and the byte path** (`e783a30f9`, `ad093fd4a`), re-driven live in 262-UAT 3.5 (thread `22c52c89`: grep/ls/tree return nothing outside scope). |
| 2 | A thread with an Expert selected offers its **"Try asking…"** prompts, and using one **starts a real run** (PACK-03) | ✓ VERIFIED | `ExpertSpotlightCard.tsx:55-56` builds the tiles from `expert.prompt_suggestions`, and each tile's click calls `onSelectPrompt(tile.prompt)` (`:196`). `ChatArea.handlePromptSelect` → `handleSend(prompt)` (`ChatArea.tsx:471-477`), mounted at `:658/:845/:865`. **A live run is recorded in the local DB:** in thread `619cdee6` the user message is the bundle's tile prompt, verbatim (*"Extract and synthesize the top 3 risk factors disclosed in the latest 10-K filing with direct citations."*), followed by a real assistant reply. Threads `22c52c89` and `ec2e49e9` show the same. |
| 3 | The **Financial Analyzer** ships end to end: selectable, scoped, prompted, and **answering from the documents or refusing**, driven as a real conversation against **real documents, not a fixture** (PACK-05) | ✗ FAILED (BLOCKER) | Selectable, scoped and prompted all hold. **Answering from the documents never happened, and cannot happen for a real user.** Local DB, read-only: folder `…0260` and doc `…0261` sit in org `430bffc6` (*"seed@system.local's Organization"*, 1 member: `seed@system.local`). The doc has `status = 'failed'`, and both chunks have `embedding IS NULL`. The resolver admits the system folder cross-org (`expert_service.py:484`), but retrieval then finds nothing. Every recorded Financial Analyzer conversation is a "there is no 10-K" reply: `619cdee6` (*"there is no 10-K filing … in your document library"*), `22c52c89` (*"there is no 10-K filing (or any document) in your knowledge base"*), and `ec2e49e9` (asks the user to paste figures). These are honest refusals, but they refuse the Expert's **own** document. That is not "against real documents". The phase's proof file is a fixture, the thing the criterion rules out (see Anti-Patterns). |

**Score:** 2/3 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `supabase/migrations/188_expert_chat_scoping.sql` | active_expert_id + Financial Analyzer knowledge | ⚠ PARTIAL | Column and index are fine. The seed is tied to a hardcoded dev org and has no embeddings (see gap). |
| `backend/app/services/run_producer.py` | pre-loop scoping, fail-closed | ✓ VERIFIED | `:378-526`; wired at `:681`, `:854` |
| `backend/app/services/agent_loop.py` | generic scoping inputs, 0 expert refs | ✓ VERIFIED | `:267-268`, `:1397`, `:1697`; AST fence test passes |
| `backend/app/services/tool_dispatcher.py` | EXPERT_CORE_TOOLS + folder wall | ✓ VERIFIED | `:4746-4759`; wall covered by `test_262_folder_scope_wall.py` |
| `frontend/src/components/chat/ActiveExpertChip.tsx` / `InviteExpertDialog.tsx` | chip + invite in `+` menu | ✓ VERIFIED | mounted `MessageInput.tsx:510`, `:604`, `:967` |
| `frontend/src/components/chat/ExpertSpotlightCard.tsx` | Try-asking tiles | ✓ VERIFIED | data from `prompt_suggestions`; wired to send |
| `backend/tests/unit/test_260_financial_analyzer_conversation.py` | PACK-05 live proof | ✗ STUB (as proof) | mocked search + self-asserted answers |

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| `threads.active_expert_id` | `run_producer._resolve_thread_scoping` | select `active_expert_id, folder_id` (`:406-415`) | WIRED |
| `_resolve_thread_scoping` | `RunContext.effective_folder_ids/effective_tools` | kwargs at `:697-698`, `:872-873` | WIRED |
| `RunContext` | tool filtering / folder subtree | `agent_loop.py:1397`, `:1697` | WIRED |
| Invite dialog / chip | `PATCH /threads/{id}` | `setThreadActiveExpert` | WIRED (live: 262-UAT 3.2/3.4) |
| Tile click | real run | `handlePromptSelect → handleSend` | WIRED (live: DB threads above) |
| Financial Analyzer folder | a real caller's retrieval | org-scoped search over the seeded chunks | **NOT_WIRED**: wrong org, no embeddings, doc `failed` |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data? | Status |
|---|---|---|---|---|
| ExpertSpotlightCard | tiles | `expert_bundles.prompt_suggestions` (3 rows in DB) | yes | ✓ FLOWING |
| ActiveExpertChip | expert | `getExpert(thread.active_expert_id)` (`ChatArea.tsx:242-258`) | yes | ✓ FLOWING |
| Financial Analyzer answer | 10-K content | chunks `…0262/…0263` | unreachable to any real user | ✗ DISCONNECTED |

### Behavioral Spot-Checks / Commands Run

| Command (cwd) | Literal result line | Status |
|---|---|---|
| `venv/Scripts/python.exe -m pytest tests/unit/test_260_expert_chat_scoping.py tests/unit/test_260_financial_analyzer_conversation.py tests/unit/test_262_folder_scope_wall.py -q` (backend/) | `27 passed, 4 warnings in 0.44s` | PASS |
| `venv/Scripts/python.exe -m pytest tests/unit/test_261_expert_runtime_scoping.py tests/unit/test_259_expert_member_isolation.py tests/unit/test_261_closed_core_inventory.py -q` (backend/) | `16 passed, 1 warning in 0.44s` | PASS |
| `GSD_VITEST_MAX_WORKERS=2 npx vitest run src/components/chat/__tests__/ComposerExpert.test.tsx src/components/chat/__tests__/ExpertSpotlightCard.test.tsx` (frontend/) | `Test Files 2 passed (2)` · `Tests 18 passed (18)` | PASS |
| `grep -ci expert backend/app/services/agent_loop.py` | `0` | PASS |
| `grep -n "ComposerExpert\|ExpertSpotlightCard" scripts/vitest-count-gate.cjs` | BASELINE `:169` (8), `:174` (9); TARGETS `:4431-4432` | PASS (F-2 fix exists) |
| read-only asyncpg on local `:54322`: `select … from documents where id='…0261'` | `status: 'failed', org_id: 430bffc6…, chunk_count: 2` | FAIL for SC#3 |
| `select id, document_id, (embedding is null) … from document_chunks where id in ('…0262','…0263')` | both `no_emb: True` | FAIL for SC#3 |
| `select … from org_members … where org_id='430bffc6…'` | only `seed@system.local` | FAIL for SC#3 |
| messages in threads with `active_expert_id = …0259` | 3 assistant replies, all reporting no 10-K / no documents | FAIL for SC#3 |

No test failed, so no inherited-failure comparison at the pre-phase commit was needed.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| PACK-02 | 260-01, 260-02 | An Expert is selectable in a chat thread and scopes that thread | ✓ SATISFIED | SC#1 evidence; fail-closed F-1 fix at `run_producer.py:430-442, 519-526`; folder wall `e783a30f9` + `ad093fd4a` |
| PACK-03 | 260-03 | An Expert ships its "Try asking…" prompts as the onboarding affordance | ✓ SATISFIED | `ExpertSpotlightCard.tsx:55,196` → `ChatArea.tsx:471-477`; live runs in DB threads `619cdee6`, `22c52c89`, `ec2e49e9` |
| PACK-05 | 260-01, 260-03 | One first-party Expert (Financial Analyzer) ships end to end, answering from the documents or refusing | ✗ BLOCKED | The seed is unreachable to every real user (hardcoded dev org, no embeddings, doc `failed`); no live answer from the 10-K exists; the proof test is a fixture |

No orphaned requirements: REQUIREMENTS.md maps only PACK-02/03/05 to Phase 260, and all three are claimed by plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `backend/tests/unit/test_260_financial_analyzer_conversation.py` | ~96-101, ~155-162, ~186-193 | Self-asserting literals: the test writes the "assistant answer" and then asserts that it contains the expected figures | 🛑 Blocker | It is presented as the PACK-05 "live conversation proof" (SUMMARY 260-03, STATE) and proves nothing about the model's answers |
| `supabase/migrations/188_expert_chat_scoping.sql` | 31, 61, 120, 129, 153 | Hardcoded environment-specific org UUID in a seed migration | 🛑 Blocker | In local that org holds only the seed user. In production, the same UUID names no customer org. |
| `backend/app/services/tool_dispatcher.py` | 4759 | module-level `assert` (stripped under `-O`) | ℹ️ Info | Already recorded by the review as residual 2; a test pins the same property |

No TBD/FIXME/XXX markers found in the phase's key files.

### Accepted Deviations (recorded in the phase record)

- **Residual 1 (`260-REVIEW.md` §Residuals, STATE.md "Residual, recorded as a DECISION"):** if reading `threads` fails transiently, EVERY chat is refused, not only Expert chats. This is accepted as a decision and is not a gap.

### Human Verification Required

None separate from the gap. Closing the gap needs a live conversation as a real user, and that is listed under `gaps[].missing`.

### Gaps Summary

Scoping (PACK-02) and onboarding prompts (PACK-03) are real, wired, fail closed, and have been driven live. The phase's own flag calls PACK-05 "the proof the whole slice is worth anything", and PACK-05 does not hold. The Financial Analyzer bundles one folder whose 10-K lives in a hardcoded local-dev org that contains only `seed@system.local`. The document is marked `failed` and its chunks have no embeddings. Every recorded conversation with the Expert ends with it saying the 10-K does not exist. The artifact the SUMMARY and STATE cite as the "live conversation proof" is a mocked fixture whose answers are written by the test. The milestone audit's phrase "Financial Analyzer populated by mig 188" is true of the rows and false of what any user can reach. The same seed would also be unreachable in production, where that org UUID does not exist.

No later v4.3 phase (261-264) addresses this, so it is not deferred.

---

_Verified: 2026-09-23_
_Verifier: Claude (gsd-verifier), independent_

---

## Addendum 2026-09-23 — PACK-05 routed, NOT closed (v4.3 milestone close)

⚠ **These closures were made by the milestone-close orchestrator, not by this verifier.** Each was
driven RED-first and re-driven green with targeted suites; none has had an independent review
cycle. The verification above is left unedited, because it is what found them.

**PACK-05 is NOT closed and is carried forward by decision.** Confirmed on the local DB at the audit:
the Financial Analyzer's only document sits in `seed@system.local's Organization` (1 member), reads
`status='failed'`, and has 0 of 2 chunks embedded. Folder sharing is org-scoped by design
(`get_globally_visible_folder_ids` → caller's org set), so no real org can retrieve it. Fixing it
needs a **tenancy decision** — cross-org system knowledge, or per-org provisioning when an org is
entitled to Experts — which is a capability, not a gap-closure fix (G-7). Routed to the next
milestone as `SEED` (see `v4.3-MILESTONE-AUDIT.md`). The tautological
`test_260_financial_analyzer_conversation.py` is to be relabelled as dispatcher wiring in that work.
