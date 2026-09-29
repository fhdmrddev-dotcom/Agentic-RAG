---
seed_id: SEED-319
title: After a mid-thread scope change, a follow-up is answered from HISTORY — 6 of 8 providers cite the dropped folder's document, one with a false location
created: 2026-09-28
surface: Agentic-RAG
status: answered
partial: false
status_note: |
  ── 2026-09-29 · Phase 268 (268-04), ANSWERED by D-268-26 (operator ruling "tell the model"). Fix `1ec11a842`
  (RED `29e64548d`): `_reconstruct_history` prepends ONE provider-neutral note to the NEXT user message after a
  non-held `scope_changed` row; words in `backend/app/services/scope_note.py`. Re-driven live, same roster / pass
  bar / retry rule: 6 of 8 PASS on the first attempt (run 1: 1 of 8); the answer cited a dropped-folder document as
  a source on 0 of 8 (run 1: 6 of 8). The 2 remaining ⛔ (openai, google) re-retrieved with grep / read_document on
  the NEW path and cited only the new folder — a pass-bar gap (those tools leave no `search.query` audit row), not
  this defect. One sample per provider. ⚠ Known limit, by the held rule: a change saved under a Restricted Expert
  gives no note, and the Expert leaving later is an `expert_changed` event, invisible to the model by D-267-10 — so
  the saved folder taking effect on that departure is not announced.
trigger_when: Any phase touching the agent loop's history reconstruction or its folder-scope system-prompt note, the scope_changed transcript event, or thread-level retrieval scope; also the next phase that promises "the next answer cites only the new folder" anywhere in its acceptance bar.
trigger_paths: ["backend/app/services/agent_loop.py", "backend/app/models/message.py", "backend/app/services/expert_scope.py", "backend/app/api/threads.py", "frontend/src/components/chat/ScopePicker.tsx", "frontend/src/components/chat/scopeCopy.ts"]
trigger_surfaces: [chat, retrieval]
migration_note:
relates_to: ["268", "SEED-286", "D-268-12", "D-267-10", ".planning/phases/268-expert-spend-mid-thread-scope/268-UAT-LOG.md (F-1)", "backend/app/services/agent_loop.py:1463-1471"]
folded_into: "268 (D-268-26, fix 1ec11a842)"
renumbered_from: null
renumbered_because: null
---

# SEED-319: After a mid-thread scope change, a follow-up is answered from history

## The finding

Measured live at Phase 268 (268-04, SC#10 board, `evidence/02-board-turn2-answers.json`). A thread scoped to
`/Client ACME` answers a payment-terms question by searching both `ACME_MSA_2026.md` (NET 60, in `/Client ACME`)
and `ACME_Q3_SOW_Contract.md` (NET 15, in `/Client ACME/Q3 Contracts`). The scope is then changed to
`/Client ACME/Q3 Contracts` and the SAME question is asked again. On the first attempt and on one retry:

- **6 of 8 providers** (anthropic `claude-sonnet-5`, google `gemini-3.5-flash`, deepseek `deepseek-v4-pro`, zhipu
  `glm-5.2`, minimax `MiniMax-M3`, openrouter `deepseek/deepseek-v4-pro`) made **no `search_documents` call** and
  answered from the earlier tool results — citing the MSA from the DROPPED folder.
- deepseek's answer, verbatim: *"Source: **ACME_MSA_2026.md** and **ACME_Q3_SOW_Contract.md** (both under
  `/Client ACME/Q3 Contracts`)"* — a **false** location.
- openai `gpt-5.6-sol` re-retrieved with `grep` on the new path and cited only the SOW; moonshot `kimi-k2.6`
  searched again and cited only the SOW.

Mechanism: the `scope_changed` row is transcript-only by design (D-267-10 / D-268-12; `_reconstruct_history` skips
it — proven live), while `agent_loop.py:1463-1471` appends a folder-scope note naming the CURRENT folder to the
system prompt. The model sees old-folder results in its history and a system prompt saying the scope is the new
folder, and re-labels the old results. Retrieval itself is correct: whenever a search runs after the change, it reads
only the new subtree (8 / 8 providers on an explicit fresh-search turn).

## Why it matters

G4-2's acceptance bar is *"Ask again: the answer cites only Q3 Contracts documents"*. A person who narrows the scope
to exclude a folder and asks again gets an answer that still quotes the excluded folder, sometimes under the new
folder's name. The UI card says `From your next message.`; for most providers the next message's ANSWER does not honour
it. This is the scope-change feature's core promise failing on the most natural follow-up.

## When to surface

Any phase that edits `agent_loop.py`'s history reconstruction or folder-scope prompt note, the `scope_changed` event
contract, or the scope picker's copy; or any phase whose acceptance bar promises the next answer honours a new scope.

## Scope estimate

Small to Medium, but a DESIGN decision first (operator): (a) send the model a short, model-facing note when the scope
changed since the last turn (a narrow exception to "transcript events never reach a model"); (b) drop or mark tool
results from before the change when reconstructing history; (c) change the copy to say earlier answers are not
re-checked. Each needs the cross-provider board re-run.

## Breadcrumbs

- 268-UAT-LOG.md §SC#10 (F-1) — board rows 1-8, runs `2a1c50a0` / `e29cb3e9` (anthropic), `6bfcf1a0` / `9a0e6c5f`
  (deepseek) … all in the dev org `22f9c615-…`.
- LM-1's first attempt and SC#4-biased's turn 2 showed the same history reuse on `deepseek-v4-flash`.
