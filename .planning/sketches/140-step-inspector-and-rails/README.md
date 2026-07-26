---
sketch: 140
name: step-inspector-and-rails
question: "How do you configure a selected step, and where does governance become visible as rails you can see but cannot wire around?"
winner: "A — Extend the shipped 400px PhaseFormPanel"
tags: [phase-184, canvas-03, canvas-04, phaseformpanel, node-config, governance-rails, tool-whitelist, grounding-bundle, locked-gates, phase-185-graded, g2-sketch-gate]
---

# Sketch 140: The step inspector + the governance rails

## Design Question

Two requirements meet on one surface.

**CANVAS-03** — configure a selected node in a side panel backed by the existing `PhaseConfig`
discriminated union. **Pydantic stays authoritative**: whatever this surface is, it is a *view* of that
union, never its own schema.

**CANVAS-04** — governance is expressed as **visible rails**: locked phase order, per-phase tool
whitelists, and validation gates the user cannot wire around. Governance rendered, never removed.

So: where does the form live, and where do the rails become legible?

## How to View

```
open .planning/sketches/140-step-inspector-and-rails/index.html
```

**Selected step** switches between the three steps (an agent step, a human-input step, and a deliverable
— deliberately three different field sets). **Rails: Show governance ⇄ Fields only** strips the rails out
so you can see what the form looks like without them. **⌥ Technical names** reveals the raw field names.

## Variants

- **A: Extend the shipped 400px `PhaseFormPanel`.** The Builder's existing right-side form, unchanged in
  shape — plain-language labels, an always-visible helper line under each, the technical term behind ⓘ,
  field set conditioned on step type. The canvas becomes a third way to *reach* the same form. Least
  net-new by a wide margin, and it pushes the canvas rather than covering it.
- **B: The inspector docks to the node.** A floating card anchored beside the selected step — the link
  between "this card" and "these settings" becomes spatial. Costs a second form surface, and it must
  reposition on pan / zoom / scroll.
- **C: Two tiers.** Rename by clicking the title; the one field that matters most for that type edits on
  the card. Tools, scope, gates and model stay in the panel.

## The three rails, and why they are where they are

| Rail | How it reads | Why it cannot be worked around |
|---|---|---|
| **Order is locked** | "Runs as step 1 of 3 — steps run in order, one after another." | `phase_index` *is* the order; there is no `depends_on`. Moving is allowed; branching is not representable. |
| **Tool whitelist** | A chip set you choose *from*. No free-text box. | Sourced live from `GET /workflows/grounding-bundle`. It is never a frontend constant — Pitfall 1: KB content can never whitelist itself. |
| **Gates** | 🔒 rows you cannot detach, `○` rows you can. | A locked gate came *with* a choice above it. Remove what made it apply and it goes; there is no switch. |

The whitelist rail carries a fourth honesty beat worth arguing about at discuss: **`web_scrape` is
present and struck through**, because the definition really does name a tool the registry does not have.
The panel does not hide it — the server already says `unregistered_tool`, and the rail's job is to make
that legible where it can be fixed. And when the bundle read itself fails, the response says `degraded`
and the picker must say *"we could not load these"* — an empty dropdown would be a lie.

## The forward seam to Phase 185

The gate rail is where **graded governance** plugs in. Today the locked gate is *derived* — the sketch
reads `citation_policy` plus the presence of a `citations_required` validator, exactly as the shipped
`groundingFor()` does. Phase 185 replaces the derivation with an authored per-node grounding mode:
**Grounded/strict keeps the locked gate, Open/flexible does not get one.** Same rail, two settings. That
is called out in-surface in violet so the container is designed for it now rather than re-skinned later.

Phase 184 must **not** invent that field.

## What to Look For

1. **Click through all three steps in each variant.** `programmatic` and `llm_human_input` carry no model,
   no tools and no folder scope; `citation_policy` exists **only** on the deliverable; `integrity_policy`
   is declared and greyed. That conditioning is the shipped behaviour, not a simplification.
2. **Flip "Fields only."** What is left is a competent form with no governance in it. That gap is what
   CANVAS-04 is asking for.
3. **In B, look at what the dock covers.** It sits on top of the step next to the one you are editing.
4. **In C, look at the card height.** 248px and it has stopped being scannable — which is precisely what
   137-D was chosen to avoid. Decide whether the speed is worth it.
5. **Try to remove a locked gate.** You cannot. Try the optional one — you can, and it says so.
6. **The `🔒 N checks that cannot be removed` badge on the node face.** One badge, not a list — the 137-D
   two-badge budget still holds.

## Grounding

Tool names are the real registry (`get_tools`, `openai_service.py`). The form's field-per-type map, the
plain-language labels, the always-visible helper lines and the ⓘ hint are the shipped `PhaseFormPanel`
(786 lines, Phase 103-04 / sketch 019-D). The panel's required `onClose` is a real invariant: for one
shipped revision the only exit was re-activating the same node, so "a panel you cannot close" was made
un-representable in the type system rather than merely tested for.

## Verification

Driven in Chrome DevTools at 1440×900 across 3 variants × 3 steps: field conditioning per type, whitelist
toggling, the struck-through unregistered tool, locked vs optional gate removal, rails on/off, the dock's
edge clamping, and inline title/prompt editing with blur-persist. No console errors; inline JS passes
`node --check`.


## Decision (operator, 2026-07-26)

**A — extend the shipped 400px `PhaseFormPanel`.** The lowest-net-new option and the only one that does
not create a second form surface to keep in step with the Builder's. The canvas becomes a third *way in*
to one form, not a second form.

Two things the build must preserve rather than rebuild, both already shipped:

- the panel **collapses to a 44px resting rail** and becomes a **bottom sheet under 768px** — needed,
  because a 400px panel beside 248px cards leaves room for roughly two steps at a 900px width;
- `onClose` stays a **required** prop, so "a panel you cannot close" remains un-representable rather than
  merely tested for.

B's node-anchored dock is the documented fallback if the panel proves too far from the step in use; C's
inline title edit is a possible later graft (rename is the single most common edit), but its full form —
prompt on the card — measured 248px tall in the sketch and stopped being scannable, which is exactly what
the card language was chosen to avoid.
