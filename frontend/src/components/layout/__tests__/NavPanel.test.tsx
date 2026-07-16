/**
 * Phase 156 (POLISH-01) — NavPanel-as-permanent-rail contract (SC#1 + D-07).
 *
 * Wave-0 `it.todo` scaffold (Nyquist target). Waves 1-2 replace each todo with a
 * live render test once NavPanel is repurposed into the thin 58px icon rail. The
 * todos enumerate every assertion the refactor must satisfy: New Chat is reachable
 * from the rail (SC#1), nav items render as tooltip-wrapped icon buttons, the
 * probe-gated operator shield stays OUTSIDE navItems (D-07), the collapse machinery
 * is gone, and the rail is stream-free.
 *
 * Deliberately imports NOTHING from ../NavPanel — the rail render does not exist yet;
 * `it.todo` takes only a string, so this file collects GREEN (pending) until Wave 1.
 */
import { describe, it } from "vitest"

describe("NavPanel rail — New Chat reachability (SC#1)", () => {
  it.todo("renders a New Chat button reachable by role name /new chat/i on every activeView")
  it.todo("New Chat click fires onNewThread and navigates to the chat view")
})

describe("NavPanel rail — nav items + operator shield (D-07)", () => {
  it.todo("renders each navItems entry as a tooltip-wrapped icon button")
  it.todo("renders NO operator shield when isOperator=false")
  it.todo("renders the amber operator shield (name /control room/i) when isOperator=true")
  it.todo("keeps the operator shield OUTSIDE navItems (probe-gated, not in NAV_ITEMS)")
})

describe("NavPanel rail — collapse machinery removed + stream-free (D-07)", () => {
  it.todo('renders NO "Collapse navigation" / "Expand navigation" toggle')
  it.todo("reads/writes NO nav_panel_collapsed localStorage key")
  it.todo("renders WITHOUT a StreamsProvider (the rail is stream-free post-refactor)")
})

// Wave 1/2 replaces each it.todo with a live render test importing the component.
