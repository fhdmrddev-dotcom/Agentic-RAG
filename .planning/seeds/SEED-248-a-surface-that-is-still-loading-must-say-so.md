---
seed_id: SEED-248
title: "A surface that is still loading must SAY so — `useDocuments` exposes no loading flag at all, so the Library's empty list is indistinguishable from \"you have no documents\"; and the thread skeleton only fires on a COLD load, so a revisit shows stale content with no sign it is refreshing"
created: 2026-09-06
planted_during: "2026-09-05/06 ingest-repair session — the operator asked for it directly after a Drive import made the app feel dead: \"I just captured as a seed, for anything that is still loading we should add a loader, especially in threads\""
status: planted
surface: Agentic-RAG
severity: medium
category: ux / honesty / loading-states
priority: medium
relates_to:
  - BUG-260905-14 (`ingest_splice._db`) — the blocking supabase calls that made the freeze VISIBLE; fixing them removed the stall but not the silence
  - BUG-260905-16 (`ingest_worker_enabled`) — CPU contention; the remaining slowness a loader has to cover
  - SEED-171 — unrelated, but the same lesson shape: a state nobody renders is a state nobody can debug
  - `frontend/src/components/chat/MessageList.tsx:212` — the ONE surface that already does this correctly
trigger_when: >
  Any phase that touches LibraryPage, useDocuments, WorkspacePanel, or the thread
  hydrate/reconcile path. Also fires immediately if a user reports "it looks empty"
  or "nothing happened" on a surface that was in fact fetching.
---

## What is true today — measured 2026-09-06, not assumed

| Surface | Loading state | Evidence |
|---|---|---|
| Chat messages | ✅ **correct** | `MessageList.tsx:212` — `isLoading && messages.length === 0` renders `<MessageSkeleton />` |
| Connections tab | ✅ **correct** | `ConnectionsTab.tsx:588` — `data-testid="connections-loading"` + `CONNECTIONS_LOADING` copy |
| **Library documents** | ⛔ **NONE** | `useDocuments.ts:146` returns `{ documents, uploading, uploadingCount, upload, deleteDoc, loadDocuments }` — **there is no loading flag to render.** `uploading` describes an UPLOAD, not the initial fetch |
| **Workspace panel** | ⛔ none found | zero loading/skeleton/spinner references |

⚠ **The `ConnectionsTab` row was nearly recorded as a gap and it is NOT one.** A first pass
grepping `isLoading|Skeleton|Spinner|animate-pulse` returned zero for it, because it names the
state `CONNECTIONS_LOADING` through its copy module. **A vocabulary grep is not an audit** —
every row above was confirmed by reading the file.

## The two distinct defects

**1. The Library cannot express "still fetching".** `useDocuments` holds `documents` and
`uploadingCount` and nothing else, so the page renders `[]` while the request is in flight.
An empty list and a loading list are **the same pixels**. This is the `ConnectionsTab` docblock's
own rule, unmet one directory over:

> *"Populated ≠ empty ≠ loading ≠ error — four different facts."*

**2. The thread skeleton only covers the COLD case.** `MessageList` gates on
`isLoading && messages.length === 0`, which is deliberate and right for a new/empty chat
(`D-068.5-11`'s Gap-01 fix stopped misleading shimmer there). But on **revisiting** a thread that
already has cached messages, a reconcile fetch renders **no indicator at all** — the person sees
possibly-stale content with nothing saying it is being refreshed. That is the case the operator
actually hit, and it is why "threads take long to load" reads as a hang rather than as work.

## Why this got noticed now, and why the loader is still needed after the fixes

The session that planted this fixed two real causes of the slowness — blocking `supabase-py`
calls on the event loop (`BUG-260905-14`) and CPU contention from in-process ingestion
(`BUG-260905-16`). **Neither makes a loader unnecessary.** Ingestion is genuinely slow work;
metadata enrichment now really runs, and camelot really does parse every page. The honest
product answer is not "make it instant" — it is **say that something is happening**.

⚠ **A loader is a claim about state, so it must be as honest as the rest of this codebase.**
Do not render shimmer where there is no in-flight request — that is exactly the misleading
shimmer `D-068.5-11` was corrected to remove. The bar is: *populated*, *empty*, *loading* and
*error* must be four visibly different things, on every surface that fetches.

## Where to start

1. Add a `loading` flag to `useDocuments` (set before the fetch, cleared in `finally`) and render
   a skeleton row set in `LibraryPage` — the smallest change that closes the worst gap.
2. Give the thread reconcile path a **quiet** refreshing affordance for the warm case (not the
   cold skeleton — the content is already there and must stay readable).
3. Sweep `WorkspacePanel` and any surface added since.
4. Consider a shared `<LoadingRows />` primitive so the fourth surface does not invent a fifth
   vocabulary — `isLoading`, `CONNECTIONS_LOADING` and `MessageSkeleton` are already three.
