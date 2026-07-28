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

## Measured (2026-07-28 — this section previously read "Not measured")

The header reclaim is no longer an inference. It was measured live at an exact 900px
viewport during `/gsd:verify-work 184`, once the operator un-maximized the Chrome window
(a maximized window is clamped by the OS, which is what had blocked it).

The consolidation is flag-gated, so flag-off renders the OLD three-band header — a true
A/B at one width, on one machine, minutes apart:

| at 900px                          | flag OFF (old) | flag ON (merged) |
|-----------------------------------|----------------|------------------|
| header chrome, bottom edge        | y=146          | **y=85**         |
| workflow content top, SPINE view  | y=255          | y=242            |
| graph surface top, CANVAS view    | —              | **y=176**        |

**61px less header chrome**, and the canvas graph surface starts **79px** above where the
flag-off content did.

**The "~90px" figure was optimistic and should not be quoted as a flat number.** Three
corrections, and the third explains the other two:

1. At 900px the measured header reduction is **61px**, not ~90px.
2. On the **Spine** view the NET gain is only **13px** — the flag-on surface reinvests most
   of the header saving in the new Spine/Canvas tablist. The large number belongs to the
   Canvas view, which is the one the phase was clearing space for.
3. **WHERE THE MISSING 29px WENT — the merged row shipped taller than its target.**
   `184-HEADER-PLAN.md:62` set the arithmetic out plainly: *"Target height ~56 px, replacing
   146 px. Reclaims ~90 px."* The measurement says the **146px baseline was exactly right**
   (flag-off header bottom: y=146, to the pixel). What missed is the target: the merged row
   measures **85px**, not ~56px. 146 − 85 = 61. So the ~90px was never an over-estimate of
   the *problem*, it was an under-estimate of the *replacement* — the one row carries more
   content, and at 900px it wraps to two visual lines while remaining a single band.
   That distinction matters if anyone revisits this: there is no lost 29px to hunt for in
   the flag-off surface, and the remaining opportunity (if it is worth taking at all) is
   making the merged row shorter — not merging anything further.

The reclaim is width-dependent: the original ~90px came from the operator's observation at
a 639px width (the "275px above a 288px canvas" row in the defects table above), where the
three bands wrap into more lines and therefore cost more. Both figures can be true at their
own widths — which is exactly why a single number should not be carried forward without one.

The direction, and the operator's "looks much better", both hold.
