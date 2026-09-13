/**
 * Phase 194.1 Plan 01 (Wave 1) — THE APPROVAL CARD IS DISPATCHABLE TODAY.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS MEASURES
 * ─────────────────────────────────────────────────────────────────────────────
 * R7's second half: *a pending approval is RETIRED WITH A SENTENCE, never
 * removed* — a card that vanishes mid-read is its own small dishonesty. Before a
 * stopped run can retire one, this pins that a `pending` card with an answer IS
 * dispatchable right now: `disabled={false}` and `aria-disabled="false"`.
 *
 * ⚠ Both attributes, not one. `disabled` is what the BROWSER honours and
 * `aria-disabled` is what a SCREEN READER announces; the shipped card sets them
 * from the same `canSubmit` (`:429-430`) and a plan that retires the card by
 * touching only one would make the two audiences disagree. Asserting the pair is
 * what makes that unrepresentable.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE THREE RETIREMENT SENTENCES ARE **READ**, NEVER RE-TYPED
 * ─────────────────────────────────────────────────────────────────────────────
 * Plan 05 owes a pairwise-distinct fence over the retirement copy. A fence built
 * on a re-typed literal tests the typing — so the three sentences are extracted
 * from the component's own `?raw` source here and recorded verbatim in
 * `194.1-BASELINE.md` §9.
 *
 * They are NOT three parallel strings, and that asymmetry is the interesting
 * part rather than a detail:
 *   (a) the 404-expiry literal    — a CONSTANT, set in the catch at `:280`
 *   (b) the countdown-timeout     — a TEMPLATE literal interpolating the clock
 *   (c) the no-deadline fallback  — a CONSTANT, the `typeof` else-arm
 * (b) is the only one that is not a fixed string, so a naive "collect the three
 * literals" fence would find two and silently think it had found three.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * GATE SCOPE — measured, and it is NOT what the directory suggests
 * ─────────────────────────────────────────────────────────────────────────────
 * This file is NOT executed by `scripts/vitest-count-gate.cjs`, even though it
 * sits in a directory that IS partly gated. `TARGETS` reaches
 * `src/components/panel/__tests__/` by THREE NAMED FILES only
 * (`PhaseReconcile.test.tsx`, `PhaseTimeline.test.tsx`, `WorkspacePanel.test.tsx`)
 * — there is no directory entry for it. *A directory that appears in TARGETS by
 * named file is not a gated directory.* See `194.1-BASELINE.md` §2.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { PendingAsk } from "@/types"

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, submitAskUserResponse: vi.fn().mockResolvedValue(undefined) }
})

vi.mock("@/providers/StreamsProvider", () => ({
  useViewingThread: () => "thread-1",
  useAskUserPrompt: () => ({ data: [], isLoading: false, error: null, reconcile: vi.fn() }),
}))

import { PendingAskCard } from "@/components/panel/PendingAskCard"
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import cardSource from "@/components/panel/PendingAskCard.tsx?raw"

/** A prompt with a real `run_id` — `runReady` is one of `canSubmit`'s three
 *  conjuncts, so a fixture without it would measure the A2 "Preparing…" gate
 *  instead of the dispatchability this suite is about. */
const ASK_WITH_RUN: PendingAsk = {
  tool_call_id: "tc-ask-1",
  prompt: "Which dataset should I use for the Q3 rollup?",
  options: ["prod_sales_2026", "staging_sales"],
  timeout_seconds: 300,
  message_id: "msg-ask-1",
  run_id: "run-ask-1",
  created_at: new Date().toISOString(),
}

function renderCard(ask: PendingAsk = ASK_WITH_RUN) {
  return render(<PendingAskCard ask={ask} reconcile={vi.fn()} />)
}

function submitButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: /send answer|preparing/i }) as HTMLButtonElement
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

afterEach(() => {
  cleanup()
})

// ─────────────────────────────────────────────────────────────────────────────
describe("194.1-01 — a pending card IS dispatchable today (R7's before)", () => {
  it("with an answer chosen, the submit button is enabled on BOTH axes", async () => {
    const user = userEvent.setup()
    renderCard()

    await user.click(screen.getByText("prod_sales_2026"))

    const btn = submitButton()
    expect(btn.disabled).toBe(false)
    expect(btn.getAttribute("aria-disabled")).toBe("false")
    expect(btn.textContent).toBe("Send Answer")
  })

  /**
   * The negative half. Without it, "enabled with an answer" is equally
   * consistent with a button that is ALWAYS enabled — and a fence that cannot
   * tell those apart has not measured the gate.
   */
  it("with NO answer, it is disabled on both axes", () => {
    renderCard()
    const btn = submitButton()
    expect(btn.disabled).toBe(true)
    expect(btn.getAttribute("aria-disabled")).toBe("true")
  })

  it("the card announces itself as pending, not expired", async () => {
    const user = userEvent.setup()
    const { container } = renderCard()
    await user.click(screen.getByText("prod_sales_2026"))

    const text = container.textContent ?? ""
    expect(text).toContain("Which dataset should I use for the Q3 rollup?")
    expect(text).not.toContain("Expired")
    expect(text).not.toContain("This prompt has expired")
    // ⚠ The state R7 introduces. Pinned absent so plan 05's inversion is proof
    // the retirement reading is NEW rather than pre-existing.
    expect(text).not.toContain("Stopping this run")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe("194.1-01 — the three shipped retirement sentences, READ from source", () => {
  it("the swept source is non-empty and is the right file", () => {
    const src = cardSource as string
    expect(typeof src).toBe("string")
    expect(src.length).toBeGreaterThan(10000)
    expect(src).toContain("export function PendingAskCard")
    /**
     * ⚠ SUPERSEDED IN PLACE BY 194.1-05 TASK 3 — `487` → `630`. The original is
     * quoted rather than overwritten (193.2 WR-05).
     *
     * SUPERSEDED (194.1-01):
     *   // `wc -l` → 486; segments → 487 (trailing newline). Both true, different
     *   // questions; §3 of the baseline record publishes the `wc -l` figure.
     *   expect(src.split("\n").length).toBe(487)
     *
     * `486 → 629` (`wc -l`), i.e. `487 → 630` segments. Task 3 added the fourth
     * retirement sentence's constant, the `runIsOver` prop, the derived `retired`
     * arm and its render, plus the `PendingAskStack` derivation — and the growth is
     * dominated by recorded reasoning rather than by logic, which is this project's
     * fifth consecutive measurement of that pattern.
     *
     * ⚠ THE PIN IS KEPT EXACT RATHER THAN RELAXED TO A RANGE, and that is
     * deliberate: this clause's only job is to prove the `?raw` sweep is reading
     * the file it thinks it is. An exact figure that must be re-derived on every
     * edit is a weaker fence than the ones around it, but it is the one that would
     * catch a `?raw` import silently resolving to the wrong module — and it goes
     * stale loudly, in the same commit as the change, which is the behaviour asked
     * for. Re-derive with `wc -l frontend/src/components/panel/PendingAskCard.tsx`
     * and add one.
     *
     * SUPERSEDED IN PLACE AGAIN BY PHASE 200 - `630` -> `650`. Both earlier figures
     * are kept above and here rather than overwritten (193.2 WR-05), so the file's
     * growth curve stays readable:
     *
     *   SUPERSEDED (194.1-05):  the same expression, pinned at 630.
     *
     * `629 -> 649` (`wc -l`), i.e. `630 -> 650` segments. +20, and NINETEEN of them
     * are the reasoning comment - the code change is a SINGLE JSX line: the free-text
     * label lost `sr-only` and gained a visible class plus a two-arm word (`Reason`
     * when the ask carries options, the shipped `Type an answer` when it does not).
     * Sketch `run-panel-parts.html` draws that label visibly; it shipped
     * screen-reader-only, so a sighted user was told nothing about what the box was
     * for while an assistive-tech user was told.
     *
     * RE-BASELINED, NOT LOOSENED, AND NOT HIDING A REGRESSION. This clause's only job
     * is to prove the `?raw` sweep reads the file it thinks it does; the three
     * retirement-sentence fences below it are UNTOUCHED and all three passed on the
     * same run, which is what says the edit did not disturb what this file actually
     * guards. The pin stays EXACT for the reason stated above - a range here would
     * stop catching a `?raw` import that silently resolved elsewhere.
     *
     * SUPERSEDED IN PLACE A THIRD TIME BY PHASE 214-11 — `650` -> `737`. Every earlier figure
     * is kept above rather than overwritten, so the growth curve stays readable:
     *
     *   SUPERSEDED (194.1-05):  630.
     *   SUPERSEDED (200):       650.
     *
     * `736` (`wc -l`), i.e. `737` segments. +87, and the CODE change is small and additive:
     * three optional props (`action` / `service` / `shape`, all defaulting so every existing
     * caller renders byte-identically), one gated `<StepIdentity>` above the question, and a
     * resolution block in `PendingAskStack` that reads the phase rows the stack ALREADY holds
     * for `runIsOver` — no new fetch, no new hook, no new store slice. The rest is the
     * reasoning: why the pause resolves nothing for itself (D-214-14 / T-214-11-04), why
     * `service: null` is a legitimate value rather than a miss, and why the shape's type is
     * reached THROUGH the element rather than from the mark module.
     *
     * RE-BASELINED, NOT LOOSENED, AND NOT HIDING A REGRESSION. The three retirement-sentence
     * fences below are UNTOUCHED and all three passed on the same run — which is what says
     * this edit did not disturb what the file actually guards. D-213-14 also stands: this
     * plan added IDENTITY and no receipt field.
     *
     * SUPERSEDED IN PLACE A FOURTH TIME BY PHASE 244-15 — `737` -> `837`. Every earlier figure
     * is kept above rather than overwritten, so the growth curve stays readable:
     *
     *   SUPERSEDED (194.1-05):  630.
     *   SUPERSEDED (200):       650.
     *   SUPERSEDED (214-11):    737.
     *
     * `836` (`wc -l`), i.e. `837` segments. +100, and the CODE change is one optional prop
     * (`onAnswered`, defaulting to `undefined` so every existing caller — `WorkflowRunPage`
     * included — renders exactly the card it rendered before), ONE guarded call on the SUCCESS
     * arm of `handleSubmit`, and a `settleAnswered` callback in `PendingAskStack` that composes
     * two things it already had: the ask `reconcile()` and the store's
     * `releaseSettledWorkflowLock`. No new fetch code, no new hook, no new store slice, and
     * ⛔ NO NEW `useState` — `grep -c "useState[(<]"` reads 9 before and 9 after, which matters
     * because a tenth would be new state ownership on a cross-surface shell with three homes.
     * The rest is the reasoning: why the callback fires on success only and never in a `catch`,
     * and why the stack reaches the STORE rather than the provider hook (eight suites mock the
     * provider module with an allow-list factory and would throw on an omitted export).
     *
     * ⚠ THIS SUITE WAS RED WHEN 244-15 FOUND IT, AND HAD BEEN SINCE `d58fa43a0`, because it was
     * in NEITHER count-gate knob — the gate never ran it and nothing guarded it. Measured at
     * this plan's base: `1 failed | 8 passed`, the single failure being this pin reading
     * `expected 766 to be 737`. It is re-baselined AND adopted into both knobs in the same
     * commit; an unpinned suite is not a lightly-guarded one, it is an UNGUARDED one.
     *
     * RE-BASELINED, NOT LOOSENED, AND NOT HIDING A REGRESSION. The three retirement-sentence
     * fences below are UNTOUCHED and all three passed on the same run — which is what says this
     * edit did not disturb what the file actually guards. The pin stays EXACT for the reason
     * stated above: a range would stop catching a `?raw` import that silently resolved
     * elsewhere, which is this clause's only job.
     */
    expect(src.split("\n").length).toBe(837)
  })

  /** (a) The 404-expiry constant — `setExpiredMessage("…")` in the catch. */
  it("(a) the 404-expiry literal is present and is a CONSTANT", () => {
    const src = cardSource as string
    const m = src.match(/setExpiredMessage\(\s*"([^"]+)"\s*\)/)
    expect(m).not.toBeNull()
    expect(m![1]).toBe("This prompt has expired — the run is no longer active")
  })

  /** (b) The countdown-timeout — the ONLY one of the three that interpolates. */
  it("(b) the countdown-timeout literal is a TEMPLATE, not a constant", () => {
    const src = cardSource as string
    const m = src.match(/`No response within \$\{([^}]+)\} — agent stopped`/)
    expect(m).not.toBeNull()
    expect(m![1]).toBe("formatClock(timeout_seconds)")
    // ⚠ Recorded because it is the trap: a fence that harvests double-quoted
    // string literals finds (a) and (c) and reports "two of three shipped
    // sentences", which reads like a missing sentence rather than a missing
    // regex.
    //
    // ⚠ AND A SECOND TRAP, FOUND BY MEASURING RATHER THAN BY READING — THE
    // NAIVE FORM OF THIS ASSERTION WAS WRITTEN, RUN, AND WENT RED. A bare
    // `expect(src).not.toContain('"No response within')` FAILS, because the
    // sentence appears in DOUBLE QUOTES inside a COMMENT at `PendingAskCard.tsx:207`
    // that explains the NaN/0 guard:
    //
    //     // NaN/0 and flip straight to "No response within 0:00 — agent stopped", i.e.
    //
    // That is this project's recurring lesson in a new place: a raw sweep reds
    // on the PROSE DOCUMENTING the thing it is sweeping for (the same reason
    // `192-05`'s `title=` fence had to be AST-parsed, and the same shape as
    // 193's D-24(a) copy fence). The honest form strips comments FIRST and then
    // asserts on code — and it must say so, because a later plan that "fixes"
    // the red by deleting the explanatory comment would be destroying
    // documentation to satisfy a mis-scoped fence.
    const codeOnly = src
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
      .join("\n")
    expect(codeOnly).not.toContain('"No response within')
    // …and the comment mention is REAL and is asserted present, so nobody later
    // reads the strip above as covering for an absence.
    expect(src).toContain('"No response within 0:00 — agent stopped"')
  })

  /** (c) The no-deadline fallback — the `typeof timeout_seconds` else-arm. */
  it("(c) the no-deadline fallback literal is present and is a CONSTANT", () => {
    const src = cardSource as string
    expect(src).toContain('"This prompt is no longer active"')
  })

  /**
   * Pairwise distinctness, asserted HERE at base so plan 05 inherits a real,
   * measured set rather than an invented one. Three sentences that shared a
   * complete sentence could not tell a reader which retirement they were in —
   * the 193.2 lesson, where a fence asserting only `a !== b` passed a plant that
   * swapped one arm's second sentence for the other's.
   */
  it("the three sentences are pairwise distinct AND share no complete sentence", () => {
    const src = cardSource as string
    const a = src.match(/setExpiredMessage\(\s*"([^"]+)"\s*\)/)![1]
    const b = "No response within {clock} — agent stopped"
    const c = "This prompt is no longer active"

    const all = [a, b, c]
    expect(new Set(all).size).toBe(3)

    // The stronger clause: no COMPLETE sentence is shared. Split on the em-dash
    // and the sentence terminators, drop empties, and require no overlap.
    const sentences = (s: string) =>
      s
        .split(/[—.!?]/)
        .map((x) => x.trim().toLowerCase())
        .filter((x) => x.length > 8)
    const [sa, sb, sc] = all.map(sentences)
    for (const [x, y] of [
      [sa, sb],
      [sa, sc],
      [sb, sc],
    ]) {
      expect(x.filter((s) => y.includes(s))).toHaveLength(0)
    }

    // ⚠ (a) and (c) BOTH open with "This prompt" and that is NOT a violation —
    // the clause is about complete sentences, not shared prefixes. Asserted
    // explicitly so a later plan does not "fix" a non-problem by rewording
    // shipped copy nobody asked it to touch.
    expect(a.startsWith("This prompt")).toBe(true)
    expect(c.startsWith("This prompt")).toBe(true)
  })

  it("the distinctness check DOES fire when two arms are collapsed (positive control)", () => {
    const collapsed = ["same sentence here", "same sentence here", "a third one entirely"]
    expect(new Set(collapsed).size).not.toBe(3)
  })
})
