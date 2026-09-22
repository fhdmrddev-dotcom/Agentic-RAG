---
seed_id: SEED-185
title: The app has no client-side router at all — twelve views, zero addressable URLs — so nothing can be shared, bookmarked, refreshed or opened in a new tab, and the browser Back button does nothing
created: 2026-08-18
planted_during: Phase 197 close — operator observation, after watching Claude navigate to localhost:5173/workflows and get the chat page
status: planted
status_note: |
  ── 2026-09-16 · reviewed at `/gsd:discuss-phase 252`, LEFT PLANTED (REG-02 sweep).
  Fired on `frontend/src/**` breadth only. 252 is scoped to the v4.2 milestone audit §8; a router is
  a capability, and G-7 forbids one in a gap-closure phase.

  ── 2026-09-22 · Phase 262 (plan 05), LEFT PLANTED — AND THE COUNT IN THIS SEED'S OWN TITLE IS NOW
  WRONG, WHICH IS THE UPDATE. `ActiveView` gained a THIRTEENTH member (the Expert catalog), so the
  title's "twelve views" reads one short; the "zero addressable" half is unchanged and is the half
  that matters. ⛔ 262 ADDS to this seed rather than eroding it: the catalog's per-Expert detail view
  is a MODAL held in page state precisely BECAUSE there is no router, so the phase shipped a second
  unlinkable surface inside an unlinkable one. A per-Expert URL stays owed and belongs to the routing
  phase. ⭐ One thing did get cheaper: `frontend/src/lib/activeViewReachability.ts` (262-01) now
  parses the union and the layout and reports any member with no render branch — so whoever does
  build the router has an executable inventory of what has to become addressable, instead of a grep.
priority: high
surface: Agentic-RAG
relates_to:
  - SEED-178 — *the open chat thread does not survive a page reload; no per-thread URL, nothing
    persisted*. ⚠ **SEED-178 IS THE THREAD-SHAPED INSTANCE OF THIS SEED.** It was planted as a chat
    defect; the measurement below shows the cause is app-wide and architectural. Close them together
    or SEED-178 will be "fixed" for threads alone and the same hole will remain for workflows, runs,
    documents and the control room.
  - BUG-260718-04 — was SPLIT because its refresh half was unreachable. This is why it was unreachable.
  - `docs/DEPLOYMENT-WORKFLOW.md` — the cloud consequence: shared links are a PRODUCT surface, and
    today every link anyone sends lands on the chat home regardless of what they meant to share.
trigger_when: >
  ALREADY TRUE. This is not a wait-for-a-signal seed; it is a standing architectural gap that grows
  with every new view. Plan it as its OWN phase, separate from the workflow-journey sketch
  (SEED-182/183/184) — it is orthogonal to visual design and must not be bundled into a design pass.

  Mechanical check, from the repo root — the whole proof is four greps:
    grep -rn "createBrowserRouter|BrowserRouter|<Routes>" frontend/src        # → nothing
    grep -n "react-router|wouter|tanstack/router" frontend/package.json       # → nothing
    grep -n "ActiveView" frontend/src/App.tsx                                 # → 12 views, one useState
    grep -rn "history.pushState|popstate" frontend/src                        # → nothing
trigger_paths:
  - "frontend/package.json"
  - "frontend/src/**"
  - "frontend/src/App.tsx"
---

# There is no router. The URL is decorative.

## What the operator noticed

> "you always navigate to the base URL slash the page that you want — for example I saw you navigating
> to localhost then the workflows page. This is something I think that even on the cloud version we
> did not consider. I don't know if this is good or bad, but it is browser-based routing, and for
> example if I want to share a thread or any page it is always on a static URL, it is not routed the
> other way. I don't know the technical terms for this."

They were right, and the terms are **client-side routing**, **deep linking**, and **URL-as-state**.

## Measured

**There is no router library and no router code.** Not `react-router`, not `wouter`, not TanStack — no
dependency in `frontend/package.json`, no `<Routes>`, no `createBrowserRouter`, no `pushState`, no
`popstate` listener anywhere in `frontend/src`.

The entire application's navigation is one line — `App.tsx:126`:

```tsx
const [activeView, setActiveView] = useState<ActiveView>("chat")
```

against `App.tsx:102`:

```tsx
export type ActiveView = "chat" | "documents" | "skills" | "settings" | "library-health"
  | "workflows" | "classification-rules" | "governance" | "skill-studio" | "control-room"
  | "org-admin" | "workflow-run"
```

**Twelve views. Zero addressable.** Loading `/workflows` cold renders **chat**, because the URL is
never read. This was verified live: Claude navigated to `http://localhost:5173/workflows` and got the
chat surface, then had to click the sidebar to reach Workflows.

⚠ **It was a deliberate, documented choice, not an accident.** `App.tsx` says so in its own comments
— *"ActiveView precedent — no router"*, *"No url router"* — and there are exactly **two** URL-aware
paths in the whole frontend, both bare `window.location.pathname ===` checks and both ENTRY flows
rather than navigation: `/setup` (`App.tsx:225`) and `/invite` (`App.tsx:242`). It was a reasonable
simplification that the product has now outgrown.

## What it costs, today

| Cannot | Consequence |
|---|---|
| Share a link to a thread, workflow, draft or run | **the single most requested thing a person does with work they are proud of** |
| Bookmark anything | every session starts at chat |
| Refresh | F5 loses your place — measured live; the Builder returns to chat (no data loss: the draft had auto-saved) |
| Open in a new tab | middle-click is meaningless |
| Use Back / Forward | the browser's own affordances do nothing |
| Link from an email, a doc, or a notification | every link lands on the chat home |

⚠ **The cloud case is the sharp one.** This is a B2B, org-scale product; a workflow run that nobody
can link to is a run that has to be described in prose instead of sent.

## Feasibility notes for whoever plans it

Not a weekend change, but not a rewrite either — the view set is small, closed and already a
discriminated union, which is the ideal starting point.

1. **The union is the route table.** Twelve members, already exhaustive and typed. A mapping from
   `ActiveView` → path is mechanical, and the compiler will find every site.
2. **Deep links need an ID and a restore path**, and that is the real work — `workflow-run`,
   `workflow` (draft), `chat` (thread) and `skill-studio` all carry a selected entity in local state
   today. **SEED-178 is exactly this problem for one of them**, which is why it should be closed here.
3. **Auth and guard ordering must be settled first.** `/setup` and `/invite` currently short-circuit
   ahead of the app; a router has to preserve the finalized-lockout and invite flows byte-for-byte.
4. **Deploy has a non-code half.** SPA history-mode routing needs a rewrite-all-to-index rule on
   Vercel; without it every deep link 404s in production while working perfectly in dev. Record it in
   the deployment parity checklist in the same commit.
5. **Feature-visibility interacts with it.** A deep link to a view the user's audience cannot see must
   land on a refusal, not a blank — the API-enforced visibility map already exists to answer this.

## How we would know this failed

- A pasted link opens the right view but empty, because the entity was never restored.
- Deep links work in dev and 404 in production (the missing rewrite rule).
- The `/setup` or `/invite` entry flows regress.
- A user reaches a view their audience is not permitted to see.
