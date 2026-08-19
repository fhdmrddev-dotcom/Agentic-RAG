/**
 * Phase 199-06 Task 2 (DES-01, sheet `c4-phase-form-panel`) — THE PANEL'S DENSITY CEILING.
 *
 * ── WHAT THIS IS FOR ────────────────────────────────────────────────────────────────────
 *
 * `PhaseFormPanel` prints a muted, always-visible, one-line plain-English helper sentence
 * directly under EVERY field label, on top of a hover ⓘ that already carries the exact
 * technical term. That is Phase 103-ux working as designed and it is also, three years of
 * fields later, SEED-184's complaint at its most literal: a label saying *Creativity* and a
 * sentence under it saying *"Higher = more varied wording"* are one idea printed twice, and
 * seven of them at once is why the panel reads as a wall. Sheet c4 draws the answer as two
 * readings of the same panel — COLLAPSED TO ESSENTIALS and FULLY EXPANDED / HIGH DENSITY.
 *
 * This module is that ceiling: one switch, one context, and the words for both states.
 *
 * ── ⚠ WHY THE STATE LIVES HERE AND NOT IN THE PANEL — A SHIPPED FENCE, NOT A PREFERENCE ──
 *
 * `PhaseFormPanel.test.tsx` asserts an ABSOLUTE ZERO of `useState` / `useMemo` / `useEffect`
 * over the panel's own `?raw` source, and its docblock records why: the panel computes
 * nothing for the surfaces it hosts, it receives finished answers and forwards them. A
 * disclosure switch is state, so putting it in the panel would have meant re-baselining a
 * guard whose whole point is that it reads zero rather than "no increase" — and a pin
 * relaxed to make red go green is a pin that will never fail again.
 *
 * So the state is HERE, and the panel gains what its own hot-file ledger row instructs:
 * its own component and one gated line. This is the fourth surface to honour that order
 * (185's governance section, 193's template attach, 193.1's name check, and now this).
 *
 * ── THE DEFAULT IS `true`, AND THAT IS THE SAFE DIRECTION ───────────────────────────────
 *
 * A consumer rendered OUTSIDE a provider reads `true` and therefore behaves EXACTLY as it
 * did before this module existed. The idiom is the panel's own "ABSENT ⇒ byte-identical"
 * rule, applied to a context instead of a prop: a dropped provider degrades to the shipped
 * surface rather than to a silently emptier one. `false` would have made a missing wrapper
 * look like a successful subtraction, which is the failure mode that is hard to see.
 *
 * ── ⚠ THE `mousedown` SUPPRESSION IS LOAD-BEARING — THE 184-11 TRAP, ONE CONTROL OVER ────
 *
 * The panel's persist seam is a field's `onBlur`. A press on any button inside the panel
 * moves focus off whatever field was focused, so the field blurs and the parent PATCHes a
 * version. The ✕ close control already suppresses its mousedown default for exactly this
 * reason (`PhaseFormPanel.tsx`, Phase 184-11 / D-184-16) — three dismissal paths looked
 * interchangeable and one of them silently wrote. **Asking to see the explanations is not an
 * edit**, so this control makes the same suppression, and nothing is lost by it: every field
 * is CONTROLLED, so a typed value reached the definition on the keystroke. Keyboard
 * activation never fires `mousedown`, so Enter/Space are untouched.
 *
 * ── WHAT MAY NOT MOVE BEHIND THIS SWITCH (SEED-184 rule 3) ──────────────────────────────
 *
 * Guidance only. A DECISION may never be folded: the governance state, which side of the
 * strict/loose door the step is on, whether the action-risk checkpoint is armed, what the
 * step delivers, and any REFUSAL. The enumerated list, with the testid that proves each one
 * rendered, is `FENCED_IN` in `PhaseFormPanel.test.tsx`, written down before anything moved.
 * The distinction in one line: a sentence that restates its own label is guidance; a
 * sentence that states what the product will or will not do is not.
 */
import { useState } from "react"
import type { ReactNode } from "react"

// 199 CR WR-03 — the context, the hook and the two control words live in `fieldGuidance.ts`.
// A component file may not export a shared HOOK (`react-refresh/only-export-components`), and
// this project answers that rule with a leaf module rather than a suppression — 27 files do,
// zero disables exist. ⚠ The `useState` below deliberately did NOT move: it is the entire
// reason this file exists, because `PhaseFormPanel`'s hook count is pinned at an absolute zero.
import {
  FieldGuidanceContext,
  FIELD_GUIDANCE_HIDE,
  FIELD_GUIDANCE_SHOW,
} from "./fieldGuidanceContext"

export interface FieldGuidanceProps {
  children: ReactNode
}

/**
 * The switch and the reading it carries. Renders its control, then `children` — no wrapper
 * element around the subtree, so it adds exactly one node to the panel and disturbs no
 * layout the panel's grid depends on.
 */
export function FieldGuidance({ children }: FieldGuidanceProps) {
  const [shown, setShown] = useState(false)

  return (
    <FieldGuidanceContext.Provider value={shown}>
      <button
        type="button"
        data-testid="field-guidance-toggle"
        data-shown={shown ? "true" : "false"}
        // `aria-expanded` rather than a `switch` role: this discloses content that is
        // already described by the labels around it, which is the disclosure pattern, not
        // a setting the user is storing.
        aria-expanded={shown}
        onClick={() => setShown((current) => !current)}
        // ⚠ See the docblock — asking to see the explanations must not fire the panel's
        // blur-persist seam. Same suppression the ✕ control makes, for the same reason.
        onMouseDown={(event) => event.preventDefault()}
        className="mb-2 rounded border border-border px-1.5 py-0.5 text-[10.5px] text-muted-foreground hover:bg-accent/40 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {shown ? FIELD_GUIDANCE_HIDE : FIELD_GUIDANCE_SHOW}
      </button>
      {children}
    </FieldGuidanceContext.Provider>
  )
}

export default FieldGuidance
