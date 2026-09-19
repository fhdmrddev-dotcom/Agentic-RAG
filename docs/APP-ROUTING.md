# App routing — what actually exists, and what it costs

> Written at Phase 257.1, after the spend cockpit shipped reachable only by **typing
> `/admin/spend` into the address bar**. Everything here is **measured against the tree**,
> not described from memory. Re-derive before trusting it; the commands are included.

---

## The one-sentence version

**There is no router.** Navigation is a `useState<ActiveView>` in `App.tsx`, and a URL path
only does something if **someone wrote a literal `window.location.pathname` check for it**.

---

## The three layers, in the order a request meets them

A path works only when **every** layer it needs is present. Each has bitten this project.

### 1. Vercel — `frontend/vercel.json` + `frontend/middleware.ts`

Resolution order is **redirects → FILESYSTEM → rewrites**, and middleware outranks all three
because it runs before the request is processed.

| what | where | covers |
|---|---|---|
| apex → app subdomain redirects | `vercel.json` `redirects` | `/app`, `/setup`, `/invite`, **`/admin`** (added 257.1) |
| host-scoped catch-all rewrite | `vercel.json` `rewrites` | `/(.*)` on host `app.*` → `/app.html` |
| single-domain fallback | `vercel.json` `rewrites` | `/app`, `/app/(.*)` → `/app.html` |
| bare root on the app host | `middleware.ts` | `/` only (`matcher: "/"`) |

⚠ **Filesystem precedence is why `middleware.ts` exists at all.** `/` matches `index.html`
on disk and is answered before any rewrite is consulted — measured against live production,
and the derivation is in that file's own docblock. Do not try to solve a root-path problem
in `vercel.json`; it cannot work.

⛔ **A new path-bearing surface needs a redirect entry too, not just the rewrite.** On
`app.<domain>` the `/(.*)` rewrite catches everything. On the **apex** there is no such
rewrite, so a path with no redirect entry and no file on disk **404s**. `/admin/spend`
shipped in exactly that state: it worked on the app subdomain and 404'd on the apex, while
`/setup` and `/invite` worked on both. Pinned by `src/__tests__/routing/vercelRouting.test.ts`.

### 2. `App.tsx` — the literal pathname checks

```bash
grep -rn "location.pathname" frontend/src --include=*.tsx --include=*.ts | grep -v test
```

Measured 2026-09-19 — **three** checks, each written separately:

| path | site | what it does |
|---|---|---|
| `/admin/spend` | `App.tsx:133` | seeds `activeView` to `admin-spend` |
| `/setup` | `App.tsx:276` | renders `FinalizedLockout` |
| `/invite` | `App.tsx:293` | renders `AcceptInvitePage` |

⚠ **The `/admin/spend` check runs ONCE, in a `useState` initialiser.** It seeds the view on
first mount and is never read again. Navigating away does not change the URL, and the URL
does not change the view afterwards. It is a **launch argument, not a route.**

### 3. `ActiveView` — the actual navigation

`App.tsx:107` holds the union; `ChatLayout` mounts one branch per value; `NavPanel` and
various in-page actions call `onNavigate(view)`.

---

## The reachability triad

A surface is reachable only with **all three**. This is the Phase-118 "built but
unreachable" lesson, and Phase 257 paid for it again.

1. a value in the `ActiveView` union (`App.tsx:107`)
2. a mount branch in `ChatLayout`
3. **an entry action** — a `NAV_ITEMS` row, a `NavPanel` rail entry, or an in-page button

⛔ **Legs 1 and 2 typecheck. Leg 3 does not exist in any type.** Nothing fails when it is
missing; the surface simply cannot be reached. That is why `NavPanel.test.tsx` now carries
explicit reachability cases for the operator entries.

### Measured coverage, 2026-09-19

| ActiveView | `NAV_ITEMS` | rail entry | mount | how it is entered |
|---|---|---|---|---|
| `chat` · `documents` · `skills` · `settings` · `workflows` · `classification-rules` · `connections` | ✅ | — | ✅ | the shared nav array |
| `control-room` · `org-admin` · `admin-spend` | ❌ *by design* | ✅ | ✅ | operator-gated rail entries |
| `skill-studio` · `workflow-run` | ❌ | ❌ | ✅ | **contextual** — from inside another page |

⛔ **Operator surfaces are deliberately OUT of `NAV_ITEMS`** (D-07 non-discoverability, locked
by `nav-items.test.ts`): that array also feeds ChatLayout's mobile drawer, so an entry there
leaks the surface to every member. Put them on the `isOperator`-gated rail instead.

---

## What does NOT work today, stated plainly

⛔ **You cannot link to a specific run, thread, document or page.**

- `activeRunId` is `useState<string | null>` in `ChatLayout:263`. It is **never written to the
  URL**. A run cannot be bookmarked or shared, and a refresh drops you back to chat.
- thread selection is the same — `useThreads`' `selectThread` is a bare `setState`.
- no surface except the three above reads the URL at all.

So today: **the URL can choose which HOME you land on (three of them), and nothing else.**

---

## Adding a new surface — the checklist

1. `ActiveView` value + `ChatLayout` mount branch.
2. **An entry action**, and a test that asserts it renders (and *does not* render for the
   audience that may not have it).
3. If it needs a URL: a literal check in `App.tsx`, **plus** a `vercel.json` redirect for the
   apex, **plus** a case in `vercelRouting.test.ts`.
4. Give the page root `h-full min-h-0 overflow-y-auto` if it scrolls — `ChatLayout`'s `<main>`
   is `overflow-hidden` and **is not a flex container**, so `flex-1` alone is inert and the
   content is clipped rather than scrollable. This shipped broken on the spend page.

---

## If deep-linking is wanted (it is not built)

⚠ **This is a decision, not a task, and it is deliberately NOT taken here.** The no-router
choice is load-bearing in several recorded places: `middleware.ts` rewrites rather than
redirects *because* `App.tsx` branches on literal paths; `vercel.json` enumerates each path;
`nav-items.ts` calls the state switch "the three-homes navigation contract".

Options, cheapest first:

1. **Query params on the existing homes** — `?run=<id>`, `?thread=<id>`. Reuses the
   `?connections=1` precedent already in `App.tsx:139`, needs no router, no new Vercel
   entries (the query string is not a path), and makes runs and threads linkable. It does
   **not** give clean URLs.
2. **More literal path checks** — what `/admin/spend` did. Works, and every one added is a
   fourth, fifth, sixth separately-written `pathname` check plus a Vercel entry plus a test.
   This does not scale and is how the current inconsistency arose.
3. **A real router** (`react-router`) — clean URLs, real deep links, browser back/forward.
   Touches `App.tsx` (23 phases, G-5 firing), every mount branch, `middleware.ts`'s rewrite
   rationale, and every `vercel.json` entry. **That is a phase, not a fix.**

⭐ **Recommendation: option 1 now, option 3 only as its own phase.** Query params close the
operator's actual complaint — *"route it through specific run, specific thread, specific
page"* — at a fraction of the blast radius, and they do not foreclose a router later.
