---
sketch: 228
title: Who will see what this brings in
phase: 231
requirement: VIS-02
guardrail: G-2
status: locked
variants: 3
winner: "B + A (B writes the copy, A guarantees coverage); C DEFERRED to Phase 233"
date: 2026-09-05
author: claude
---

# 228 · Who will see what this brings in

> ✅ **LOCKED 2026-09-05 (operator): B + A.** B's audience rows are the control and write the copy;
> A's always-on footer is the coverage rule binding every path B does not reach — including the
> edit-later screens. **C is DEFERRED to Phase 233**, whose preview shares the surface and can name a
> real file count. Build both halves or the SC#1 clause is met by audit rather than by construction,
> which is the failure mode it was worded to prevent.

**G-2 sketch for Phase 231 / `VIS-02`.** A connection is about to place documents into the knowledge
base that **nobody chose to upload**. The sentence naming who can then read them **is the
deliverable**, not decoration around it.

## The criterion decides the axis

> **SC#1:** *"A person setting up a connection reads **one plain sentence** saying who will be able to
> see everything it brings in — before it brings anything in. **There is no configuration path where
> that sentence is absent.**"*

⭐ **So the deciding axis is COVERAGE, not eloquence.** A variant that reads beautifully on the happy
path but can be skipped on an edit-later screen fails the clause outright. That single reading is what
separates the three.

## The three variants

| | Variant | Shape | Verdict |
|---|---|---|---|
| **A** | **The always-on scope footer** | The sentence is bound to the *control*, not to a step — the 024 pattern (*"you can never pick a model without seeing where it runs"*) | ✅ **guarantees coverage by construction** — there is no path to audit, because the footer *is* part of the field |
| **B** | **The sentence IS the option** | 069-A audience rows; each choice states its own consequence | ✅ **the strongest copy** — you cannot choose without reading what the choice does |
| **C** | **The pre-sync gate** | A moment before first sync: 4 facts + the sentence + Start / Change | ⚠ **earns attention, but alone FAILS the criterion** |

## Recommendation — B as the control, A as the guarantee

**They are not rivals.** B writes the copy; A is the rule that the copy appears on *every* path,
including the edit-later screens B never reaches. Together they satisfy the *"no configuration path
where that sentence is absent"* clause **by construction rather than by audit** — which is the only
way a clause worded that strongly can actually be met.

⛔ **C alone fails, and the reason is worth keeping.** A gate fires on *first sync*. Editing a
connection's scope afterwards is a configuration path with **no gate and therefore no sentence** —
precisely what SC#1 forbids. C is not wrong; it is **incomplete in exactly the way the criterion was
written to catch.**

⚠ **C is also a collision, not just a cost.** It shares a surface with **Phase 233**'s preview, and it
is the only variant that can name a real file count (*148 files*) because by then the preview has run.
**Recommend deferring C to 233** and letting the preview carry the moment — building it here risks two
screens saying the same thing.

## What B says that A cannot

B's org row names the real hazard on screen:

> *"All 26 people in Acme Corp will be able to read these documents and the agent will quote them in
> answers — **including to people who cannot open the original in Google Drive**."*

That last clause **is Pitfall 2 stated in the UI** — the connecting user must not silently become a
gateway. A footer can omit it; a row that *is* the choice cannot.

## D-5 rendered honestly — the department row is deliberately absent

The stored value is enum-shaped (`private | org | dept`) and the resolver carries a `dept` branch, but
**no UI offers it**. A scope nobody can grant must not be shown. ***Inert means invisible.***

This is **069-A's extensible-audience contract applied inbound**: audience values are enum-shaped
records **never booleans**, and audience resolution sits behind **one swappable function**. The same
contract that lets v3.4 org-RBAC grow into a picker lets departments grow here — without the
re-ingest that adding a scope after the predicate is set would otherwise cost.

## Open — the operator decides

1. **B + A, or B alone?** A costs a persistent footer on a screen that also has B's rows; there is a
   real argument that on *that* screen it is redundant. The coverage rule still binds every *other*
   screen either way.
2. **Copy: "Everyone in Acme Corp" vs "All 26 people in Acme Corp."** The count is more honest and more
   alarming. Both are drawn.
3. **Defer C to Phase 233?** (recommended)

## Not drawn, and owed

⚠ **The revoked state has no home on this surface.** D-4 says disconnecting **freezes** a connection's
documents rather than deleting them — that sentence needs somewhere to live, and this sketch does not
give it one. Flagged rather than invented.

## Files

- `index.html` — all three variants side by side, each with its own notes column recording why it wins
  or loses. Rejected paths are kept so the question can be re-felt if it reopens.
