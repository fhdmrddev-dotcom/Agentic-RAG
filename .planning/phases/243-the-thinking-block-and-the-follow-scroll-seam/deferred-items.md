## `Plan04.frontend.test.tsx` — one INHERITED red, in a suite NEITHER gate knob names (found by 243-04)

`frontend/src/__tests__/components/Plan04.frontend.test.tsx` §"Atom C" fails:
`AssertionError: expected '' to contain 'text-emerald-400'`.

**Not this plan's, and not new.** Measured:

- The suite is in **neither** gate knob — `grep -c "Plan04.frontend" scripts/vitest-count-gate.cjs`
  is **0** — so the phase's green `count gate OK` never saw it and never could.
- `text-emerald-400` no longer exists on the node the case asserts: `grep -rln "emerald-400"
  frontend/src/components/chat/` returns **`StepRow.tsx` only**, i.e. the class moved when
  **Phase 227-02 decomposed `ToolCallPanel`** (`a743aeef4`). The suite itself was last touched at
  `d1e724361` (Phase 095-05) and was never re-aimed.
- 243-04's whole diff is `ThinkingBlock.tsx` + its two suites; it adds and removes no colour class.
  The suite fails identically in isolation.

**Deferred, not fixed** (SCOPE BOUNDARY: only issues DIRECTLY caused by this plan's changes are
auto-fixed). ⚠ The useful finding is the second bullet's shape, not the red itself: **a suite that
is in neither knob is invisible to the gate, so a class rename can orphan it for 16 phases and the
verdict line still reads `count gate OK`.** Same failure mode `SEED-222` names for the six unpinned
suites, one file over.


---

## `StreamingNarration.tsx` — ZERO production callers after `243-05`, and its retirement is OWED, not taken

`243-05` removed the component's last production caller (`MessageItem.tsx`'s content ternary) to
close CHAT-05: the final answer was being written **inside** that fold. The file is
**byte-identical** — `git diff --stat -- frontend/src/components/chat/StreamingNarration.tsx` is
empty — and `243-05-PLAN.md` forbids deleting it in this plan, in as many words.

**State, measured after the fix:**

- production callers: **0** (`grep -rn "StreamingNarration" frontend/src --include=*.tsx` returns
  only its own file, `src/__tests__/components/StreamingNarration.test.tsx`, two docblock mentions
  in `CitedMarkdown.tsx` / `ThinkingBlock.tsx`, and two comments in `StreamsProvider.tsx`)
- its own suite still runs and still passes (3 cases), so the component is *covered* while being
  *unmounted* — the shape `192.2-06` recorded for `src/dev/SketchLibraryCard.tsx`: a surface that
  outlived its purpose with the obligation carried by prose rather than by anything executable
- it carries the identical `max-h-64 overflow-y-auto border-l-2` nested scroller that `243-04`
  removed from the thinking body — ⛔ **that is NOT a reason to "fix it while in there"**
  (`243-PATTERNS` §F.4); it is narration, not reasoning

**Owed decision, for a later phase to take deliberately:** delete the component + its suite, or
re-purpose it. ⛔ **Whoever takes it must NOT re-mount it on the live answer path** — that re-opens
`BUG-260707-03` exactly as it stood. Two stale references also go with it: `StreamsProvider.tsx`
`:2151` and `:2615` still describe *"StreamingNarration's fold gives way to a clean answer"*, which
is now a description of a fold nothing renders. Left alone here on purpose — `StreamsProvider` is a
G-5-firing file and `243-05` modified it not at all.
