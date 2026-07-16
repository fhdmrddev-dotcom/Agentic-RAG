/**
 * Phase 156 (POLISH-01) — ThreadCommandPalette ⌘K contract (SC#2 global finder).
 *
 * Wave-0 `it.todo` scaffold (Nyquist target). Wave 2 replaces each todo with a live
 * render test once the palette exists. Per the resolved research decision the palette
 * is HAND-ROLLED on the existing Radix ui/dialog.tsx — there is NO cmdk dependency —
 * so the todos also lock the "no cmdk import" contract. The todos enumerate the
 * open/filter/roving-select/Esc behaviors + the dialog/listbox/option a11y roles.
 *
 * Deliberately imports NOTHING from ../ThreadCommandPalette (component not built yet)
 * and NO cmdk; `it.todo` takes only a string, so this file collects GREEN (pending).
 */
import { describe, it } from "vitest"

describe("ThreadCommandPalette — open + filter (SC#2)", () => {
  it.todo('exposes role="dialog" with an accessible name (e.g. /search all chats/i)')
  it.todo("⌘K / Ctrl-K opens the palette from any activeView")
  it.todo("typing filters the list to title-substring matches over ALL threads")
  it.todo('shows the honest empty-state "No chats match your search." when nothing matches')
})

describe("ThreadCommandPalette — keyboard roving + select (SC#2)", () => {
  it.todo("ArrowDown / ArrowUp move the active option (aria-selected / aria-activedescendant)")
  it.todo("Enter calls onSelectThread, navigates to chat, and closes the palette")
  it.todo("Escape closes the palette and restores focus to the previously-focused element")
})

describe("ThreadCommandPalette — a11y roles + no new dependency", () => {
  it.todo('the results expose role="listbox" with role="option" rows')
  it.todo("imports NO cmdk (hand-rolled on the existing Radix ui/dialog.tsx)")
})

// Wave 1/2 replaces each it.todo with a live render test importing the component.
