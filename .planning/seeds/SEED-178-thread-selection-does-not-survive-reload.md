---
seed_id: SEED-178
title: The open chat thread does not survive a page reload — no per-thread URL, nothing persisted — which is why "restore the model across REFRESH" was unreachable and BUG-260718-04 had to be split
created: 2026-08-18
planted_during: Phase 196 verification (G-4 row U-C1, driven live with Chrome DevTools MCP against localhost:5173)
status: planted
priority: medium
relates_to:
  - BUG-260718-04 — the report this seed was SPLIT OUT OF. Its navigate half is closed by Phase 196;
    this seed carries the refresh half, which was never a model-selection defect at all.
  - Phase 196 D-18 / plan 196-07 — `frontend/src/hooks/useComposerModel.ts`, the restore this seed
    proves is NOT at fault. Restore-on-navigate was verified live.
  - The hot-file ledger's `frontend/src/components/chat/ChatArea.tsx` section — a G-5-firing file and
    the surface any fix would land on. Read its named seam before planning.
  - SEED-135 — registry-backed model resolution, the wider family this sits in.
trigger_when: >
  This is not a "wait for a signal" seed — the condition is ALREADY TRUE and reproducible today. Plan it
  when someone next touches chat navigation, routing, or session restore. The mechanical check, run in
  the browser console with a thread open:

    JSON.stringify({
      url: location.href,
      ls: Object.keys(localStorage),
      ss: Object.keys(sessionStorage)
    })

  As measured 2026-08-18 this returns `url: "http://localhost:5173/"` (bare — NO thread id),
  `ls: ["chat_history_collapsed"]`, `ss: []`. **The seed is discharged when the url carries a thread
  identifier (or a persisted key holds one) and an F5 lands the user back in the same conversation.**
---

# SEED-178 — the open thread does not survive F5

## What was measured, and how

Driven live during Phase 196 verification, G-4 row **U-C1**, with Chrome DevTools MCP against the
running app (frontend `localhost:5173`, backend `:8000`, live local Postgres `:54322`).

1. Opened thread ***Weekly Report Generation*** from the chat list.
2. The composer read **`Ollama` / `qwen3-30b-a3b-instruct-2507@q4_k_xl`** — **byte-matching that
   thread's most recent `runs` row** (`model`, `provider`). ✅ Phase 196's restore works on navigate.
3. Pressed F5 (`navigate_page` reload).
4. **The thread was gone.** `document.body.innerText` no longer contained the conversation
   (`hasThreadContent: false`); the app sat on a **new chat** showing the global default
   `deepseek` / `deepseek-v4-flash`.
5. Re-checked at **3.5 s and again at 9.5 s** to rule out a slow settle. Same result both times.

## Root cause — thread selection is persisted NOWHERE

| Candidate home | Measured contents |
|---|---|
| URL | `http://localhost:5173/` — **bare, even with a thread open**. No per-thread route. |
| `localStorage` | `["chat_history_collapsed"]` — and nothing else. |
| `sessionStorage` | empty. |

So after a reload there is no thread to restore *into*. The composer showing the global default in a
**brand-new** thread is **correct behaviour**, not the defect BUG-260718-04 described.

## ⚠ Why this had to be split out rather than left inside BUG-260718-04

BUG-260718-04's close condition read *"restores its last-used model across navigate AND refresh"*.
**That condition is UNREACHABLE AS WRITTEN** — no amount of UAT can pass *"REFRESH and see the model
still selected"* while refresh discards the thread itself. Leaving the report open against a condition
it structurally cannot meet would have parked a **verified, shipped fix** behind an unrelated missing
capability, indefinitely.

⚠ **The refresh half was never a model-selection bug.** It is *"the app forgets which conversation I
was in"* — a navigation/session-restore concern with a different root cause, a different owner file,
and a different fix. Phase 196 neither scoped it nor could have fixed it.

## What a fix probably looks like (not a decision — the next phase decides)

The cheap, conventional option is a **per-thread route** (`/chat/:threadId` or equivalent), which makes
reload, deep-linking, browser Back/Forward, and "copy the link to this conversation" all fall out of one
change. A persisted `lastThreadId` key is cheaper still but buys only the reload case and leaves the
URL non-shareable.

⚠ **Do not treat this as a small change.** It lands on `ChatArea.tsx`, which the hot-file ledger records
as **G-5-firing and the strongest frontend extraction case in the tree**. Read its detail section in
`docs/HOT-FILE-LEDGER.md` for the named seam and binding invariants **before** planning, and expect the
G-5 audit to demand a refactor recommendation as the first option rather than the feature.

## Blind spot this seed inherits

Once threads DO survive reload, Phase 196's restore starts running in a context it has never been
observed in. The two blind spots BUG-260718-04 named for itself become live and should be re-checked
then, not assumed: a restored model that is **no longer enabled** in the registry (mitigated by
`resolveRestoreTarget`'s disabled refusal, but never observed live), and a thread whose last message
**predates the feature** being left with no sensible default.
