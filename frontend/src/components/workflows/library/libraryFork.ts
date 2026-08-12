/**
 * Phase 192.1-03 Task 1 (LIB-05 — D-01 / D-22, threats T-192.1-05) — THE FORK'S TWO PURE
 * LEAVES, moved off `WorkflowsPage.tsx` under G-5.
 *
 * The `CLAUDE.md` hot-file ledger row for that page named this exact seam — *"the two
 * fork/create handlers with their slug/version mechanics are now the largest self-contained
 * concern left on the page"* — and named WR-08 as the trigger that would force someone into
 * them. 192.1's fork name-prompt (162-B) is that second concern arriving, so the
 * recommendation was produced as the first option and taken. This module is the bottom of the
 * cut; `useWorkflowFork.ts` is the rest of it.
 *
 * ⚠ THE MOVE IS GENUINELY BYTE-PRESERVING, AND THAT WAS VERIFIED RATHER THAN ASSUMED. Both
 * symbols were MODULE-SCOPE declarations on the page and close over NOTHING — no state, no
 * prop, no `useCallback` dependency, not even an import. RESEARCH §1b's closure analysis says
 * so for each of them (*"NOTHING. Module-scope, pure … Truly verbatim"*), and the bodies below
 * are the shipped ones character for character; only the file they live in changed. That is
 * what makes this half of the extraction risk-free in a way the hook's half is not.
 *
 * PURE + CLIENT-SIDE, in the `libraryFilter.ts:13-16` / `soulData.ts:13-15` sense: **this
 * module imports NOTHING at runtime** — not the API client, not React, not the DOM. It needs
 * no wire type either, so there is not even an `import type` line. The claim is asserted over
 * this file's own source in `libraryFork.test.ts`, because a purity claim a fence cannot bind
 * to is a comment rather than a contract.
 */

/** Phase 143 (WF-01 / D-143-1) — a 6-char base36 fork-slug suffix for the fresh-copy
 *  fork (`<starter-slug>-<hash>`). Robustly 6 chars of [a-z0-9] even if a single
 *  Math.random().toString(36) run falls short (rare), so it always matches the
 *  `<slug>-[a-z0-9]{6}` shape the fork/collision contract expects (Pitfall 5). */
export function freshHash(): string {
  let h = ""
  while (h.length < 6) h += Math.random().toString(36).slice(2)
  return h.slice(0, 6)
}

/**
 * 192-15 (WR-03) — IS THIS FORK FAILURE A SLUG/VERSION COLLISION? ONE HOME FOR ONE QUESTION.
 *
 * It changes NOTHING about behaviour. `onUseStarter` already asked this question inline to
 * decide whether to retry, and `onTweak` now has to ask it to decide which true sentence to
 * show — and two copies of one predicate are two answers to one question waiting to disagree.
 *
 * ⚠ WR-08, RECORDED HONESTLY RATHER THAN HIDDEN BEHIND A TIDY NAME: keying control flow on
 * ERROR PROSE is fragile, and giving it a function does not make it less so. `createWorkflowDraft`
 * throws a bare `Error` whose MESSAGE carries the status (`…(status 409)`), so the status code is
 * only reachable as a substring. The real fix is a typed error at the throw site — an `api.ts`
 * change with callers OUTSIDE this page (notably `useDraftPersistence`), which is a new surface
 * and therefore out of scope for a gap-closure round under G-7. Naming it here is the honest
 * middle: the fragility now has exactly one place to be fixed instead of two.
 *
 * RE-OPEN TRIGGER: the next phase that touches `createWorkflowDraft`'s throw site replaces this
 * substring test with the typed error's own discriminator, in the same commit.
 *
 * ⚠ 192.1-03 (D-22) — IT MOVED, IT WAS NOT UPGRADED, AND THE DIFFERENCE IS DELIBERATE. Sketch
 * 163 floats 162-B's name field as a natural home for the 409; it is not one — the 409 is a
 * `UNIQUE(slug, version)` violation and the pre-flight check reads DISPLAY NAMES. The two
 * residual failing rows are `published + published` slugs with no draft, and no name field
 * prevents that. `useDraftPersistence.ts:426-470` shows what this predicate is NOT (it
 * classifies by error NAME, structurally) — and D-22 forbids making that change here, because
 * the throw site has callers outside this subtree. The trigger above is the whole plan.
 */
export function isForkConflict(e: unknown): boolean {
  return String(e).includes("409")
}
