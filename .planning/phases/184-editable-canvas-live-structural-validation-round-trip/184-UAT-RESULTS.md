# Phase 184 + 184.1 — operator UAT results

**Run:** 2026-07-28, operator-driven, local stack (Supabase + backend + vite), canvas flag ON.

## Result: PASS — all six steps

| # | Step | Result |
|---|---|---|
| 1 | Open the add-step menu, dismiss without choosing | PASS — outside-click and Escape both close |
| 2 | Add steps via the `＋` picker | PASS — plain-language options, cards added |
| 3 | Drag sideways to reorder + flicker check | PASS — reorders, undo lights, **no flicker** |
| 4 | Drag vertically only | PASS — card stays, affordances follow, undo stays greyed |
| 5 | Delete a middle step + Undo | PASS — immediate, no confirm, message + working Undo |
| 6 | Narrow window / unfinished state | PASS — header "looks much better", no overflow |
| U-1 | Empty draft after deleting everything | PASS — "Add your first step" invitation shown |

## Six defects found by the operator, all fixed and confirmed

| Defect | Root cause | Commit |
|---|---|---|
| `✕` / `＋` unreachable with a mouse | `pointer-events:none` inherited from `ViewportPortal`; reveal bound to the element's own `:hover`, which it could never receive | `222a1e52` |
| Add-menu opened but no row clickable | Same cause, third `ViewportPortal` child — the picker wrapper | `49938645` |
| `＋`/`✕` stranded when a card moved | Affordances positioned from the LANE constant, ignoring nudge + live drag | `49938645` |
| Menu could not be dismissed | Dismiss listener on the BUBBLE phase; d3-zoom `stopPropagation`s mousedown on the plane (measured: 0 bubble hits, 1 capture hit) | `0b23850a` |
| Header consumed the canvas | Three stacked bands, 275px above a 288px canvas | `154f2a3a` + phase 184.1 |
| Dragged card blinked | `adoptUserNodes` re-reads `measured` from OUR object when the reference changes; ours carried none, so the node rendered `hidden` every frame | `b75db366` |

**The pattern:** four of six were the same class — code that RENDERED correctly but did not
WORK, invisible to a suite that asserts class lists under a jsdom that applies no CSS. Each
now has a test at the level jsdom can reach, falsified against the operator's exact symptom.

## Known gap, not a defect

**R10a's orphaning refusal has no reachable live path.** `canRemovePhase` refuses only when
another step's validator sends failures to the step being deleted. `skip_to_phase` is used
**0 times across all 108 live definitions**, and 184 deliberately does not let you author
one, so the refusal ships unexercised outside its unit tests. Re-open at Phase 188, where
skip-target authoring would land.

Note: the test script's step 3 originally asserted "deleting the last step is refused".
That rule does not exist and must not — an empty draft is a valid state (D-184-15), and
adding such a rule would break the "Add your first step" path. Instruction error, corrected.

## Not measured

The header's ~90px reclaim is structural inference: the suite proves the band count fell
3 → 1, jsdom reports zero heights, and Chrome MCP wedged before a live measurement. The
operator's verdict was "looks much better" at a narrowed window.
