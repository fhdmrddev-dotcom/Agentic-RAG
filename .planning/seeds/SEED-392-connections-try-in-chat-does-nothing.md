---
seed_id: SEED-392
title: The Connections "Try in Chat" menu item does nothing
created: 2026-10-27
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: Any phase whose files_modified names ConnectionsTab.tsx or ConnectionsPage.tsx, or that gives the Connections page a navigator prop.
trigger_paths: ["frontend/src/components/settings/ConnectionsTab.tsx", "frontend/src/pages/ConnectionsPage.tsx"]
trigger_surfaces: ["connectors"]
migration_note:
relates_to: ["frontend/src/components/settings/ConnectionsTab.tsx", "frontend/src/pages/ConnectionsPage.tsx", "297-02", "D-20", "D-37"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-392: The Connections "Try in Chat" menu item does nothing

## The finding

Each connection row's ⋯ menu on the Connections page offers **Try in Chat**
(`frontend/src/components/settings/ConnectionsTab.tsx`, `data-testid="connections-action-try-chat"`).
Selecting it does nothing, and it has done nothing since it shipped.

Before Phase 297-02 its handler set the URL hash to `#chat`. Nothing in `frontend/src` ever read
that hash, so the click changed the address bar and left the person where they were. 297-02
deleted the write (D-20, resolved to DELETE by D-37). With the router mounted, a raw hash write
would also erase the router's History entry index (D-33). The item still renders and still does
nothing, so the visible behaviour is unchanged.

No navigator reaches this tab. `ConnectionsPage` mounts `<ConnectionsTab />` with no props, and
`AppViewSwitch` mounts `<ConnectionsPage />` with no props either. Wiring the item means adding
a prop path that 297 did not own.

## Why it matters

A menu item that does nothing is a small broken promise. The person picks it expecting to try
the connection in a chat, and nothing happens, with no message. The cost is low but real: it
makes the menu look unfinished. Nobody has reported it, which fits a control whose failure is silent.

## When to surface

Surface it at the next phase whose `files_modified` names `ConnectionsTab.tsx` or `ConnectionsPage.tsx`,
or that threads `onNavigate` (or any navigator) into the Connections page. At that point either
wire the item, ideally to a new chat with the connection active, or remove it.

## Scope estimate

Small to Medium. Removing the item is about one line. Wiring it needs a navigator prop through
`AppViewSwitch` → `ConnectionsPage` → `ConnectionsTab`. Wiring it well also means deciding what
"try" means for a connection: a prefilled prompt, or a thread scoped to that connector.

## Breadcrumbs

- Phase 297-02, commit `feat(297-02): every view has an /app address; runs route-held, ?run= writers retired`: the hash write was deleted.
- `297-RESEARCH.md` § Legacy Shapes at HEAD, row "`ConnectionsTab.tsx:1142-1150` Try in Chat", and Open Question 3.
- `297-CONTEXT.md` D-20 and D-37.
- `frontend/src/__tests__/routing/noRawHistoryWrites.test.ts` now fails on any `location.hash =` in product code, so the old shape cannot return.
