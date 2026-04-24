# Phase 43: UI Redesign — Mobile & Responsive - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 043-ui-redesign-mobile-responsive
**Areas discussed:** AppDock on mobile, Mobile menu trigger & placement, Drawer close pattern

---

## AppDock on mobile

| Option | Description | Selected |
|--------|-------------|----------|
| Hide entirely | AppDock hidden on mobile — full-width main. Nav icons move into drawer. | ✓ |
| Bottom nav bar | AppDock transforms into horizontal bottom tab bar on mobile. | |
| Single hamburger button only | AppDock collapses to just a hamburger icon strip. | |

**User's choice:** Hide entirely (recommended)
**Notes:** AppDock gone on mobile; nav icons (Chat, Documents, Library Health, Skills, Settings + Sign Out) live inside the frosted drawer's bottom section.

---

## Mobile nav access follow-up

| Option | Description | Selected |
|--------|-------------|----------|
| Nav icons inside the drawer | Drawer has thread list + compact icon row at bottom for full navigation. | ✓ |
| Chat-only on mobile | Mobile is chat-only; Documents/Skills/Settings not accessible on small screens. | |

**User's choice:** Nav icons inside the drawer (recommended)
**Notes:** One drawer surface handles both thread selection and navigation on mobile.

---

## Mobile menu trigger & placement

| Option | Description | Selected |
|--------|-------------|----------|
| Top-left of ChatArea header | Menu icon (lucide-react), `md:hidden`, in existing chat header bar. | ✓ |
| New sticky mobile-only top bar | Dedicated mobile top bar with app logo + hamburger above ChatArea. | |

**User's choice:** Top-left of ChatArea header (recommended)

---

## Drawer close pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Backdrop tap only | Tapping frosted backdrop closes drawer. No X button. | ✓ |
| Backdrop tap + X button | Explicit close button + backdrop tap. | |
| Backdrop tap + thread selection closes it | Auto-close on thread pick + backdrop tap. | |

**User's choice:** Backdrop tap only (recommended)
**Notes:** Thread selection does NOT auto-close the drawer. Nav icon selection DOES close the drawer (D-03).

---

## Claude's Discretion

- Drawer slide-in animation duration and easing
- Whether to use `<dialog>` element or `<div aria-modal>` for the drawer
- Drawer nav icon row internal layout
- Whether drawer state lives in ChatLayout or MobileDrawer

## Deferred Ideas

None.
