---
phase: 243-the-thinking-block-and-the-follow-scroll-seam
verified: 2026-09-11T02:58:20Z
verification_mode: self-verified   # ⛔ OV-SOLO-01 / D-243-12 — NEVER "reviewed". No independent §6.3 reviewer exists.
status: passed
score: 5/5 success criteria verified MECHANICALLY · 0/20 UAT rows driven
overrides_applied: 0
base_commit: 3412bb6ab
head_commit: b5560a62d
gate:
  command: "GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs (repo root)"
  verdict: "count gate OK — 255/255 pinned files present, no per-file decrease, 0 failing"
  total: 8030
  pinned_total: 7257
  failing_set: []        # SUBSET of BASELINE's two inherited sketchComposition cases — empty. Criterion met.
typecheck:
  command: "cd frontend && npx tsc -p tsconfig.app.json --noEmit"
  errors: 67             # identical to 243-BASELINE.md's base figure
  set_diff: "empty — no error in any file this phase touched"
human_verification:
  - test: "L-2 — on a >=50-message thread, scroll up mid-tool-call with a REAL mouse/trackpad and stay there through the rest of the call and the tokens that follow"
    expected: "The reader is not dragged to the live edge; the Jump-to-live chip stays visible"
    why_human: "⛔ RUN THIS ONE FIRST. Every CHAT-03 fence in this phase is a synthetic WheelEvent, and BUG-260823-01's own file records TWO prior fixes that measured clean on synthetic events and were refuted by a real mouse. This is the single row with a documented history of synthetic-green/real-red."
  - test: "L-1 — watch a slow reasoning model stream"
    expected: "The fold control does not churn; the line does not flicker per token"
    why_human: "CHAT-02's mechanism is measured (60 deltas -> <=14 scrolls, <=11 setMessages). 'Does not flicker' is a PERCEPTION and no fence can see it. BUG-260718-02 stays `folded` for exactly this reason."
  - test: "L-6 — put the shipped surface beside .planning/sketches/234-the-thinking-block/index.html, V1 tab"
    expected: "They agree, with the three differences enumerated in this report and nothing else"
    why_human: "Sketch-to-build drift is the ROADMAP's named failure mode. Three differences are identified below by reading both files; only a side-by-side can find a fourth."
  - test: "L-3 — ask a reasoning model a plain question that calls no tools"
    expected: "The thinking line renders"
    why_human: "Structurally closed (one unconditional renderer, fenced on source). The live cross-provider behaviour is not."
  - test: "L-4 — start a run, navigate away, come back WITHOUT reloading"
    expected: "The final answer is body text, not folded in narration"
    why_human: "§6a/§6b assert STORE state through the provider's own callbacks, not the DOM; the render half is asserted separately. The two halves have never been observed in one live run."
  - test: "L-5 — open the fold on a 33,713-char body, then on a 198-char one"
    expected: "The tail is readable behind a clamp; the short one looks finished, with no inert control"
    why_human: "Both ends are fenced (clamp §1/§3). 'Readable' and 'looks finished' are perceptions."
  - test: "M-1 — one prompt exercising 2+ tools (search_documents + execute_code)"
    expected: "The thinking block sits above MULTIPLE tool rows; no tool row is restyled, re-ordered or re-labelled"
    why_human: "⚠ Carries a NEW question this phase created: 243-05 removed the narration fold, so a live multi-tool turn now renders the model's INTERIM NARRATION inline as body text (fenced deliberately — see O-3). Only an operator can say whether that reads as calm."
  - test: "P-1 — Thread A streaming reasoning while Thread B accepts a new prompt"
    expected: "No cross-thread leakage; B's first token is not delayed by A's coalescing window"
    why_human: "The coalescer's per-instance isolation is fenced (§9, §10e). The 60 ms window's felt cost on a second thread is not."
  - test: "G-1 — criterion 3 on a thread with >=50 prior messages or a >=5 KB prompt"
    expected: "The scroll fix holds at scale"
    why_human: "The vitest fixture is 54 messages, but in jsdom with stipulated geometry. The ROADMAP names 'verified once by hand and never on a thread with fifty messages' as a failure mode."
  - test: "Axis 1 — the FULL native roster + OpenRouter (8 rows), derived from MODEL_CAPABILITIES, driven per-request on POST /threads/{id}/messages"
    expected: "Each row answers the four questions in 243-VALIDATION.md §Axis 1; a provider that emits no reasoning is a legitimate blocked row WITH its reason"
    why_human: "Reasoning is a PROVIDER-SHAPED feature and zero providers were exercised in this phase. DeepSeek is the row that must pass — this surface was built for it at Phase 076.2."
  - test: "N-1..N-4 — fold-open mid-stream · fold survives the temp-id->DB-id reconcile live · a no-tool reasoning turn below tool-bearing ones · Stop mid-reasoning"
    expected: "Per 243-VALIDATION.md §Rows added by this phase's plans"
    why_human: "N-2 and N-4 have synthetic fences (§13, the terminal flush); N-1 and N-3 do not. All four are lived-experience rows by construction."
---

# Phase 243: The Thinking Block and the Follow-Scroll Seam — Verification Report

**Phase Goal:** While a model is thinking, the operator sees one calm, structured surface instead of a monospace blob repainted once per token — and if they scroll up to read something, the product leaves them there.

**Verified:** 2026-09-11T02:58:20Z · base `3412bb6ab` → HEAD `b5560a62d`
**Status:** `human_needed`
**Re-verification:** No — initial verification.

---

## ⛔ WHAT THIS DOCUMENT IS, STATED BEFORE ANYTHING IT CLAIMS

**This is a SELF-VERIFICATION, not a review.** `OV-SOLO-01` / `D-243-12`: solo running continues and no
independent §6.3 reviewer exists. Per that decision, every row below is tagged:

| Tag | Meaning | Weakened by solo running? |
|---|---|---|
| **MECHANICAL** | a driven fence, a byte-identical file, a measured count, a command's own output | **No** |
| **JUDGEMENT** | a reading of whether a shipped surface matches an intent | **Yes** — a second pair of eyes would be worth having |

Every claim in this report was established by opening the file or running the command named beside it.
**No criterion was scored from a SUMMARY.** Where a SUMMARY claim was checked and found imprecise, that
is recorded rather than absorbed.

---

## Goal Achievement — the five success criteria

| # | Criterion | Status | Kind | Evidence |
|---|---|---|---|---|
| 1 | Single calm line; expanding gives structure; **matches the operator-approved sketch** | ✓ VERIFIED (3 differences declared) | MECHANICAL + JUDGEMENT | `ThinkingBlock.tsx:194-282` vs `sketches/234-the-thinking-block/index.html:127-146, 236-247` |
| 2 | Long reasoning stream updates steadily; repaint count does not track token count | ✓ VERIFIED (mechanism) | MECHANICAL | `throttle.ts:70-107`, `StreamsProvider.tsx` delta path; `MessageList.scroll.test.tsx` §7 — 60 deltas → ≤14 scrolls, lossless |
| 3 | Scroll up during a tool call and **stay there** | ✓ VERIFIED (mechanism) | MECHANICAL | `useFollowScroll.ts:152, 171-173, 211-239`; `MessageList.scroll.test.tsx` §3/§4/§5 on a **54-message** thread |
| 4 | A reasoning model with **no tool calls at all** still shows its thinking | ✓ VERIFIED | MECHANICAL | `MessageItem.tsx:372-378` — unconditional mount; `ThinkingBlock.tsx:193` self-guard; tree-wide grep: exactly ONE renderer |
| 5 | A run finished elsewhere shows its final answer **out of the narration fold**, no reload | ✓ VERIFIED | MECHANICAL | `MessageItem.tsx:442-449` — the arm and its import are GONE; `MessageItem.answerOutOfFold.test.tsx` §1/§2/§6a/§6b |

**Score: 5/5 verified mechanically. 0/20 UAT rows driven.**

⛔ **That second number is the reason this report is not `passed`.** It is also not `gaps_found` — no
must-have failed, no artifact is a stub, no key link is unwired, no debt marker is unreferenced.
**Closing with the G-4 board owed is a legitimate DECISION and is stated as one, never as a claim
that everything ran.**

---

### Criterion 1 — scored against `index.html`, NOT against the phrase "structured timeline"

⚠⚠ **CARRIED VERBATIM FROM `243-VALIDATION.md`, as that file demands, because a verifier scoring this
criterion against the ROADMAP's wording scores it wrong:**

> The ROADMAP criterion reads: *"expanding it gives a **structured timeline** rather than a flat wall."*
> **That wording predates the sketch it defers to**, and the sketch settled the question the other way.
> Stitch **V2 Segmented** (mono labels per block) was ⛔ REJECTED — *"The labels are ours, not the
> model's"*. Stitch **V3 Beats** (four one-line bullets) was ⛔ REJECTED — it *"discards the model's
> actual words"*. **V1 Thin rule WINS — it *"adds nothing and invents nothing"*.**
> ⇒ **V1's paragraph structure IS the "structure" criterion 1 asks for.** A literal timeline —
> per-block labels, beats, a step rail — **is an explicit operator rejection and must NOT be built.**

**It was not built.** `grep` over `ThinkingBlock.tsx` finds no label map, no beat list, no step rail.
The structure is real `<p>` elements.

**The V1 diff table, checked line by line against the file rather than against a description of it:**

| V1 requires (`index.html` + D-243-02) | Shipped | Verdict |
|---|---|---|
| Fold control: **unchanged component**, only the `label` prop moves | `ThinkingBlock.tsx:217-220` mounts the shared `FoldTrigger` | ✓ |
| ⛔ **No `count`** | `FoldTrigger` called with `open` + `label` only; `count` absent | ✓ fenced §4a/§4b |
| Body drops `font-mono`, `whitespace-pre-wrap`, `max-h-64`, `overflow-y-auto`; `text-xs`→`text-sm` | `:242` = `px-3 py-2 text-sm text-muted-foreground leading-relaxed border-l-2 border-muted-foreground/20 ml-3` | ✓ fenced §5 (both the presence AND the absence halves) |
| `border-l-2` and `ml-3` **stay** | both present at `:242` | ✓ |
| Real paragraphs (`index.html:332` `ps.map(p => <p>)`; `.reasoning p{margin-bottom:11px}` / `last-child{0}`) | `:249-253` — `toParagraphs(...).map` → `<p className="mb-[11px] last:mb-0">` | ✓ **numerically identical**, fenced §5b-i/-iii/-iv (lossless) |
| Clamp `max-height:300px; overflow:hidden; position:relative` | `:246` — `relative max-h-[300px] overflow-hidden` | ✓ |
| Fade `height:76px`, gradient to page bg | `:262` — `h-[76px] bg-gradient-to-t from-background to-transparent` | ✓ |
| Control `margin:9px 0 0 28px; text-xs; primary; underline; offset 2` | `:275` — `ml-[28px] mt-[9px] text-xs text-primary underline underline-offset-2` | ✓ **numerically identical** |
| Copy `Show all of it` / `Show less` | `:277` | ✓ |
| Control **removes itself** below the threshold | `:270` — `{overflowing && (...)}` | ✓ fenced §3 (median 198-char body gets no control, no fade, no cap) |
| Tool rows **untouched — operator constraint** | `ToolCallPanel.tsx`, `StepRow.tsx`, `toolMeta.ts`, `tool-bodies/` all **byte-unchanged** across `3412bb6ab..b5560a62d` | ✓ MECHANICAL |
| Fold default **unchanged — folded at rest AND while streaming** | `:163` `useState(false)`; `setThinkingOpen` appears only in `onOpenChange`; no effect opens it | ✓ fenced §3, §14f |

**Three differences from the bar exist. One is declared in `243-VALIDATION.md`; two are declared only
in code and are surfaced here so the count is honest.**

| | Difference | Declared where | Verdict |
|---|---|---|---|
| **D-1** | A message the client did not watch stream reads `Thinking`; the mockup reads `Thought for 6 seconds` (`index.html:338` = `Math.round(chars/180)`, a demo affordance) | **`243-VALIDATION.md` §L-6 + D-243-13 + ROADMAP plan line** | ✅ **DECLARED = a decision.** Honoured mechanically: `grep -c "/ 180"` over `frontend/src` = **0**; §14c/§14d fence the no-digit path; `git diff --stat -- supabase/ backend/` **EMPTY** |
| **D-2** | The clamp threshold is a **measured** `scrollHeight > 301px`, not the sketch's `chars < 700` proxy | `ThinkingBlock.tsx:172-178` only | ⚠ **In-code declared, absent from VALIDATION.** The reasoning is sound and arguably MORE faithful to the sketch's own stated intent (*"removes itself rather than sitting inert"*) — but an 800-char body that fits in 300px gets no control where the mockup would show one. **JUDGEMENT.** Fenced §4 |
| **D-3** | The sketch's **live-state accent** (`.think.live .fold-trigger{color:primary}`) and its **animated three-dot** label (`index.html:401`) are not ported; shipped keeps the pre-existing literal `"Thinking..."` | Nowhere | ⚠ **UNDECLARED.** Defensible: D-243-02's binding diff table says only the SETTLED label changes, and `"Thinking..."` is the shipped base label (`RunCard.tsx@3412bb6ab:495`). But a strict side-by-side sees it. **JUDGEMENT — this is what L-6 is for** |

⇒ **Criterion 1: TRUE**, on the file. **D-1 is a decision. D-2 and D-3 are recorded here rather than
discovered at L-6.**

---

### Criterion 2 — the cadence

**MECHANICAL, end to end:**

- `frontend/src/lib/throttle.ts:70-107` — `makeAccumulatingCoalescer`, a **new** export beside the
  unchanged `makeThrottle`. Leading edge (`:89`), no arguments (so nothing a window can drop),
  `.flush()` that closes the window.
- `StreamsProvider.tsx` — `DELTA_COALESCE_MS = 60`, a **named exported constant** with its number
  argued in the docblock. `onDelta` and `onReasoningDelta` both write a closure buffer
  (`pendingContent` / `pendingReasoning`) and call `coalesceDeltas()`; `applyPendingDeltas` drains it
  in **one** `setMessages` with the update shape unchanged (`prev.map`, new array, new object).
- ⭐ The trap the plan did not name, found by driving: **every structural callback drains the buffer
  first**, implemented as a generic wrapper over all 47 callbacks with the rule stated in the
  **negative** (`FILLS_THE_BUFFER = {onDelta, onReasoningDelta, flushDeltas}`). Without it Anthropic's
  interleaved text/tool_use order inverts. This is the right shape: the 48th callback cannot forget.
- Flush at all three `onTerminal` wrapper sites, **at the top** of each wrapper (`:1722`, `:2057`,
  `:2510`), because those bodies reconcile the message and a late flush would append onto replaced
  content.

**The measurement, run by the gate as part of `failed 0`:**

| Fence | Measures | Result |
|---|---|---|
| `streamsProvider_243_cadence.test.tsx` §1 | 60 reasoning deltas over ~600 ms | ≤ `1 + ceil(600/60) = 11` `setMessages`, not 60 |
| §2 | losslessness after terminal flush | reasoning is the **exact** concatenation of all 60 |
| §6 | first-paint cost | first delta paints immediately — no window elapses |
| `MessageList.scroll.test.tsx` §7 | 60 deltas through the **real** `makeStreamCallbacks` into the **real** `MessageList` | **≤ 14 scrolls** (was 60), and `content` is byte-exact |

⇒ **TRUE (mechanism).** ⚠ The criterion's other half — *"observable by an operator watching a slow
reasoning model"* — is **not measured**. `BUG-260718-02` stays `folded` on exactly this ground. **L-1 owed.**

---

### Criterion 3 — the scroll

⭐ **The most important thing about this criterion is that the fix was DRIVEN before it was written,
and the drive refuted the register.** `D-243-05` instructed a RED drive at HEAD rather than a fix
against `BUG-260823-01`. Outcome **3**: a residual reproduced and it is **not** the defect the report
names — that report blames a one-animation-frame programmatic flag, and that code has not existed
since `64357e979` (2026-09-04, an **untagged quick task**, not Phase 228; the mislabel is corrected
beside the original in `243-CONTEXT.md`).

**The shipped repair, read in the file:**

- `useFollowScroll.ts:152` — `lastGestureIntentRef`, added beside the existing `lastGestureAtRef`.
- `:172` — `noteUserGesture` records the intent.
- `:236` — the re-arm now requires a **third** condition: `lastGestureIntentRef.current !== "up"`.
- ⛔ It is a **direction, not a ban** — a deliberate flick back DOWN, and any `"unknown"` gesture
  (touch drag, scrollbar grab), still fall through to the geometry. The mirror case is fenced.

**`MessageList.tsx` is BYTE-UNCHANGED across the phase.** That is D-243-04's claim measured: the
CHAT-03 half of the seam moved because the CHAT-02 half did. **CHAT-02 and CHAT-03 landed in ONE plan
(`243-03`) — the ROADMAP's second failure mode did not occur.**

| Fence | Covers |
|---|---|
| §0 | the fixture really is **54** messages and the harness really mounted |
| §1 | pinned + streaming: one scroll per token render, `behavior: "instant"` |
| §2 | the smooth branch's **argument**, not its existence |
| §3 | ⭐ the residual: 60 px nudge up, then an unattributed scroll 1000 ms later (past the 900 ms clock, inside the 1500 ms window) — the chip stays, and 4 further token renders produce **0** scrolls |
| §4 | a decisive scroll-away: 12 renders, **0** scrolls |
| §5 | ⭐ the mirror: a flick back DOWN re-arms and following resumes |
| §6 | **settled** (not streaming) + a new message: bottom anchor, `behavior: "smooth"` — the "breaks the settled view" failure mode |

⇒ **TRUE (mechanism).** ⚠⚠ **And the honest caveat, which the phase itself insists on: every fence
here is a synthetic `WheelEvent`.** `BUG-260823-01`'s own file records **two prior fixes that measured
clean on synthetic events and were refuted by a real mouse.** The report is correctly left `folded`,
not `closed`, and its `re_open_trigger` now names the real-wheel row. **L-2 is the first row to run.**

---

### Criterion 4 — reasoning on a tool-free reply

**MECHANICAL, and the strongest criterion in the phase:**

- `MessageItem.tsx:372-378` — `<ThinkingBlock reasoningContent isStreaming reasoningMs />`, a direct
  sibling of `WorkingBadge`, **above** the tool-gated `RunCard` mount at `:379-381`. **No tool test,
  no `key`.**
- `ThinkingBlock.tsx:193` — `if (!reasoningContent) return null`. The block decides for itself; the
  mount site decides nothing. **The tool-conditionality is gone by construction, not by a second branch.**
- **Exactly ONE renderer — established independently of the SUMMARY and of the suite.** A tree-wide
  `grep -rn "reasoningContent" frontend/src` (non-test) returns 20 hits; each was opened:

| Site | What it is | A renderer? |
|---|---|---|
| `ThinkingBlock.tsx:249` | `toParagraphs(reasoningContent).map(p => <p>)` | ✅ **the one** |
| `MessageItem.tsx:374` | prop pass | no |
| `MessageItem.tsx:206`, `:641` | `!!` boolean into `outerBannerLabel` | no — a label call |
| `RunCard.tsx:487` | `!message.reasoningContent && …` guard on the **planning placeholder** | no — it draws only when reasoning is ABSENT |
| `lib/api/threads.ts:92`, `types/index.ts:214`, docblocks | wire mapping / type / prose | no |

- Fenced three ways by the suite: §12 (source: the mount carries no `tool_calls` and no `key=`), §8
  (behaviour: a zero-tool reasoning reply renders its thinking — this case was written as a
  **declared-defect** case by `243-01` and **inverted** by `243-02`), §10c (uniqueness, with §10a
  proving the sweep is non-empty and §10b proving the needle discriminates).

⇒ **TRUE.** **CHAT-04 is genuinely closed.**

---

### Criterion 5 — the answer out of the fold

**MECHANICAL:**

- `MessageItem.tsx` — the `StreamingNarration` arm is **deleted** and so is its import
  (`grep -n "import.*StreamingNarration" MessageItem.tsx` → no output). The only remaining textual
  occurrence, at `:449`, is **inside a JSX comment** that preserves the original arm verbatim — I
  opened `:440-460` to confirm this rather than trusting the grep count.
- ⇒ **The answer can no longer be routed into a fold at all.** That is a stronger result than "the
  reconcile now fires": the defect's home is gone.
- ⭐ The narrower alternative (gate the fold on `hasRunningTools`) was **rejected on a measured
  ground** — it oscillates once per iteration, and holding it open needs state, which would re-hollow
  the Phase 227 discharge. Recorded in code at `:465-471`.
- §1 asserts all three paragraphs render as real body text; §2 asserts document order
  (thinking → run card → answer) via `compareDocumentPosition`, not indices; §3 asserts the caret
  survives and sits **after** the body; §4 asserts `StreamingNarration` is neither deleted nor
  restyled; §5 asserts the citation branch and absence hint keep their gates.
- **The navigation path**, §6a and §6b, driven through `StreamsProvider`'s **own** callbacks and
  reconcile — §6b is the harsh reading: the run ends with **no client callback at all** and only the
  navigate-back reconcile can resolve it. Both assert `runStatus !== "streaming"` and
  `content === CLEAN_ANSWER` on the store.

⚠ **Precision the SUMMARY glosses:** §6 asserts **store state**, not the DOM. The render half is §1/§2.
Together they close the criterion; separately neither does. Recorded so a later reader does not
mistake §6 for an end-to-end render check.

⇒ **TRUE.** **L-4 owed** for the lived half.

---

## The seven failure modes — what prevents each, in the shipped code

| # | Failure mode | Prevented by | Kind |
|---|---|---|---|
| 1 | *"The thinking block is restyled and the flicker survives — the repaint cadence was never touched, only the CSS"* | **Both were touched, in different plans, and both are measured.** The CSS is `243-04` (`ThinkingBlock.tsx:242`); the cadence is `243-03` (`makeAccumulatingCoalescer` + the delta path). §7 measures 60 deltas → ≤14 scrolls. | MECHANICAL |
| 2 | *"CHAT-02 and CHAT-03 land in different plans that do not see each other; the smooth-scroll branch gets fixed twice with opposite intent"* | **They landed in ONE plan (`243-03`, commits `ac599e645`/`bfdf899b1`/`8d7dfab43`).** `MessageList.tsx` is **byte-unchanged** across the whole phase — the smooth branch was never edited at all, let alone twice. | MECHANICAL |
| 3 | *"Works while streaming and breaks the settled view, or works on a short thread and fails on a long one"* | `MessageList.scroll.test.tsx` §6 is the **settled** path (`behavior: "smooth"`, bottom anchor); the fixture is **54 messages** and §0 asserts it (`LONG_THREAD_SIZE = 54`, `expect(…).toBeGreaterThanOrEqual(50)`). §5 is the mirror. | MECHANICAL — but in jsdom with stipulated geometry; **G-1/L-2 still owed** |
| 4 | *"The sketch is approved and the build drifts from it; the phase closes against a description of the mockup rather than the mockup"* | **The mockup file was opened and the V1 diff table checked line by line** (table above). Numeric values agree exactly: `11px`, `300px`, `76px`, `9px`/`28px`, `underline-offset 2`. Three differences are enumerated; one is pre-declared. | MECHANICAL (the classes/numbers) + JUDGEMENT (whether the result *reads* the same — **L-6**) |
| 5 | *"A green composition fence coexists with the shipped defect because it asserts a block is PRESENT by data-testid while the content drifts"* | **The fences assert CONTENT.** §5 asserts the class-token set both ways (present AND absent); §5b-i asserts per-element text, not a container substring; §5b-iv asserts losslessness; §4a/§14c/§14d assert the trigger's **exact text** and the absence of any digit; §5b-ii asserts `max-h-*`/`overflow-*` by **shape**, not by literal. ⭐ And §11 was **re-anchored during `243-05`** from `getByTestId("streaming-narration")` to the rendered content — the original is preserved in the comment, because it had used the FOLD as a proxy for the answer, which *is* the defect. | MECHANICAL |
| 6 | *"Reasoning appears on pure-text replies but the streaming cursor, the narration banner or the citation branch regress"* | All three named by name: §3 (caret present, and **after** the body, and still withheld while a tool runs), §4 (`StreamingNarration` still folds and still self-guards — and the file is **byte-identical**), §5 (absence hint's gate byte-unchanged and fenced both ways; a LIVE cited answer still routes to `CitedMarkdown`). | MECHANICAL |
| 7 | **CONTEXT's own:** *"CHAT-03 is fixed against a stale bug report"* | ⭐ **The strongest-prevented mode in the phase.** `D-243-05` forbade fixing against the report and required a RED drive at HEAD first; `243-03` task 1 (`ac599e645`) did exactly that, found outcome **3**, and the correction is recorded **beside** the original in `243-CONTEXT.md` and in `BUG-260823-01` — including a second correction when "Phase 228" turned out to be a mislabel for an untagged quick task, established with `git log -S "hardProgrammaticUntilRef"`. | MECHANICAL |

**No failure mode is unprevented.** Two (3 and 4) carry a residual that only a browser can retire.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `frontend/src/components/chat/ThinkingBlock.tsx` | the ONE reasoning renderer | ✓ VERIFIED | 283 L, 4 commits. Substantive, wired, data flows from `message.reasoningContent` |
| `frontend/src/components/chat/MessageItem.tsx` | unconditional mount; narration arm removed | ✓ VERIFIED | 707 → 755 L; **not re-hollowed** (below) |
| `frontend/src/components/chat/RunCard.tsx` | G-5 discharge by deletion | ✓ VERIFIED | 729 → **710 L**; real `useState` **3 → 2**; `FoldTrigger` + `Collapsible` imports gone |
| `frontend/src/lib/throttle.ts` | accumulating leading-edge coalescer | ✓ VERIFIED | 40 → 108 L; `makeThrottle` untouched |
| `frontend/src/providers/StreamsProvider.tsx` | coalesced delta path + measured span | ✓ VERIFIED | `+206/-15` ignoring whitespace |
| `frontend/src/hooks/useFollowScroll.ts` | intent-aware re-arm | ✓ VERIFIED | `+47` — one ref, one clause |
| `frontend/src/components/chat/MessageList.tsx` | — | ✓ **BYTE-UNCHANGED** | The claim that it needed no edit is measured, not asserted |
| `frontend/src/components/chat/StreamingNarration.tsx` | untouched, not deleted | ✓ **BYTE-UNCHANGED** | `git diff --stat` empty; **zero production callers** |
| Tool-row surfaces | untouched (operator constraint) | ✓ **BYTE-UNCHANGED** | `ToolCallPanel.tsx`, `StepRow.tsx`, `toolMeta.ts`, `tool-bodies/` — all empty diffs |
| `supabase/`, `backend/` | no migration | ✓ **EMPTY DIFF** | `git diff --stat 3412bb6ab b5560a62d -- supabase/ backend/` returns nothing |

### The named measurements, re-run rather than quoted

| Check | Claimed | **Measured by this verification** |
|---|---|---|
| `MessageItem.tsx` re-hollowed? | `useState` 3→3, `useEffect` 0→0, props 5→5 | ✅ **CONFIRMED.** `const [.*] = useState` → **3 at base, 3 at HEAD**, identical names/lines. `useEffect(` → **0 → 0**. Signature byte-identical: `{ message, isStreaming, onSendMessage, onResume, isLastAssistant }`. **Not re-hollowed.** |
| `RunCard.tsx` shrank? | `-39/+20`, 729→710, one `useState` fewer | ✅ **CONFIRMED.** `wc -l` **729 → 710**. Real `useState` declarations **3 → 2** (`thinkingOpen` gone). ⚠ A naive `grep -c "useState("` reads **4 → 2** because a comment in the deleted block matched — the ledger section already records both figures and why. |
| Fabricated duration | `grep -c "/ 180"` = 0 | ✅ **0** over all of `frontend/src`. `reasoningContent.length` appears once, in `types/index.ts:223`, **as the prohibition**. |
| No-span message renders no digit | fenced §14c/§14d | ✅ `ThinkingBlock.tsx:150` — `if (reasoningMs === undefined) return "Thinking"`. `reasoningMs` is client-only, stamped only during a watched stream. |
| Fold default | folded at rest AND while streaming | ✅ `:163` `useState(false)`; `setThinkingOpen` reachable only from `onOpenChange`. No auto-expand anywhere. |
| Both gate knobs | all 7 suites in `BASELINE` **and** `TARGETS` | ✅ **CONFIRMED, all 7**: `ThinkingBlock.characterization` (`:2936`/`:4770`), `ThinkingBlock.clamp` (`:2953`/`:4773`), `MessageItem.answerOutOfFold` (`:2972`/`:4781`), `streamsProvider_243_cadence` (`:2997`/`:4800`), `MessageList.scroll` (`:3016`/`:4804`), `throttle.test` (`:3032`/`:4808`), `useFollowScroll.test` (`:3281`/`:4670`) |
| Ledger + CLAUDE.md | rows + sections, same commit, cells ≤ 200 chars | ✅ `node scripts/check-hot-file-ledger.cjs <phase-dir>` → **exit 0**, *"252 rows · subject 22 files · watched 8 · every watched file has a row"*. `node scripts/check-claude-md-size.cjs` → **exit 0**, CLAUDE.md **88,891 chars / 59.3%**, no `[disposition-too-long]`. Sections exist for `ThinkingBlock.tsx` (`:1626`), `useFollowScroll.ts` (`:10584`), `throttle.ts` (`:10652`). ⭐ `useFollowScroll.ts` and `throttle.ts` had **NO ROW FOR THEIR ENTIRE LIVES** — G-5 was structurally absent on the very file `BUG-260823-01` is about. |
| Debt markers | none | ✅ `TBD|FIXME|XXX` → **0** across all seven source files. `TODO|HACK|PLACEHOLDER` → **0** in `ThinkingBlock.tsx`. |

---

## Gate Execution — SET DIFFS against `243-BASELINE.md`, not absolute verdicts

```
GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs      # from the repo root

  total                                      7257    8030    +773
  total 8030  ·  failed 0  ·  pinned total 7257
count gate OK — 255/255 pinned files present, no per-file decrease, 0 failing.
```

| Criterion (from `243-BASELINE.md`) | Required | Measured | Verdict |
|---|---|---|---|
| failing set ⊆ the two inherited `sketchComposition` cases | subset, possibly empty | **∅ — empty** | ✓ |
| no per-file DECREASE | none | none | ✓ |
| in-scope suites green | all 7 | all 7 pinned, `failed 0` | ✓ |

⚠ **`count gate OK` is NOT the criterion and is not quoted as one** — the base was RED (`failed 2`) and
CLAUDE.md/`BASELINE` both forbid that criterion here. The subset relation is what passed. ⚠ **One green
run is not proof the inherited pair is fixed** — `SEED-171`'s claim is that the failing set is never the
same twice. The honest statement is *"the inherited pair did not reproduce on this run"*, never *"fine"*.
The cap was `2` and was neither adjusted nor needed; the gate was green first time, so no
capture-the-JSON triage was entered.

```
cd frontend && npx tsc -p tsconfig.app.json --noEmit     # ⛔ NOT `npx tsc --noEmit` — that checks ZERO files
  → 67 errors
```

| | Base (`243-BASELINE.md`) | HEAD | Verdict |
|---|---|---|---|
| error count | **67** | **67** | ✓ |
| errors in any file this phase touched | — | **0** | ✓ set diff empty for the blast radius |

The 67 sit in `ConnectionFormPanel`, `IngestionTab`, `ChatAreaMode`, `useMessages`, `FilesSection`,
`LibraryPage`, `SettingsPage`, `lib/api` and friends — none of them this phase's.
⛔ **"Zero tsc errors" is unreachable here** and no criterion was written as one.

---

## Requirements Coverage

| Requirement | Status in code | Status in `REQUIREMENTS.md` | Verdict |
|---|---|---|---|
| **CHAT-01** | closed structurally + visually | `[ ]`, annotated *"Code-complete, UAT-owed"* | ✓ honest |
| **CHAT-02** | closed mechanically | `[ ]`, **no annotation at all** — and the prose still reads *"`lib/throttle.ts` … is wired only to the cache writer, never to the UI path"*, which is now **FALSE** | ⚠ **W-1** |
| **CHAT-03** | closed mechanically | `[ ]`, **no annotation**; mapping table row still bare *"Pending"* | ⚠ **W-1** |
| **CHAT-04** | ✅ closed | `[x]` with the wrong-line-number correction recorded beside the original | ✓ exemplary |
| **CHAT-05** | closed mechanically | `[ ]`, annotated *"Code-complete, UAT-owed"*, with the refuted clause struck through not deleted | ✓ honest |

⭐ **Leaving CHAT-01 / CHAT-03 / CHAT-05 unticked pending the browser row is the RIGHT call** and is
stated as a decision in the file. **W-1 is the opposite problem**: `243-03` shipped CHAT-02 and CHAT-03
and updated neither, so a register now carries a sentence that the phase's own code refutes. That is
the exact rot mode this phase diagnosed three times in other registers.

---

## What is OWED — recorded, not silently dropped

### 1. ⛔ G-4 lived-experience UAT — **no browser was ever opened in this phase**

`243-VALIDATION.md` carries **L-1..L-6**, the SC#10 4-axis board (**8-provider roster**, M-1 multi-tool,
P-1 parallel-thread, G-1 long-message) and **N-1..N-4**. **None has been driven.** Zero providers were
exercised; zero reasoning streams were watched; zero real wheels were turned.

**This is stated as a DECISION to close with the board owed, never as a claim that everything ran.**

**Run L-2 first** — on a ≥50-message thread with a real mouse/trackpad. It is the only row with a
*documented history of synthetic-green/real-red* (`BUG-260823-01` records two such fixes), it is
criterion 3's whole lived half, and it is the named `re_open_trigger` on that report.

Then **L-1** (the flicker perception, `BUG-260718-02`'s open half), then **L-6** (side-by-side against
`index.html`, which is the only thing that can find a **fourth** difference beyond D-1/D-2/D-3), then
**L-4**, **L-3**, **L-5**, then the 8-row provider board with **DeepSeek** as the must-pass row.

⛔ `243-VALIDATION.md`'s *"Owed / blocked ledger"* table is still **EMPTY**. It should be filled with the
above before the phase is called done. That file's own rule: *"An owed row stays visible; it is not
deleted from the table."*

### 2. Three bug reports stay `folded`, not `closed` — **verified in each frontmatter**

| Report | `status` | `verified_closed_by` | Reason recorded in the file |
|---|---|---|---|
| `BUG-260823-01` | `folded` | `null` | *"243-03 fixed a residual under DRIVEN vitest fences. NOT `closed`: this file records TWO prior fixes that measured clean on synthetic events and were refuted by a real mouse. Closure needs the real-wheel UAT row."* |
| `BUG-260718-02` | `folded` | `null` | *"⛔ stays null until a human watches a reasoning stream. Code-half commits are named in the verdict section, deliberately NOT here."* |
| `BUG-260707-03` | `folded` | `null` | *"NOT closed: every fence here is synthetic. G-4 browser row owed."* Residual #1 open since **2026-07-07** while the code half has been called done three times. |

✓ All three carry a `re_open_trigger` naming the specific row. **Correct and honest.**

### 3. `SEED-269` planted; `SEED-049` **not** re-opened — both verified

- ✅ `.planning/seeds/SEED-269-one-home-for-the-elapsed-formatter.md` exists, `status: planted`,
  naming all **three** file-local elapsed formatters (`RunCard.tsx:588-594`, `MessageList.tsx:49-58`,
  `ThinkingBlock.tsx thoughtForLabel`) and why the extraction was declined **here** (it would edit two
  files outside the plan's `files_modified`, so neither would get its same-commit ledger update — and
  the ledger gate reads `files_modified`, not the diff, so it could not have caught the omission).
- ✅ `SEED-049` is **unchanged** by this phase and remains `status: deferred`, with
  `fired_not_folded: "v4.1 / 243"`. **Its re-open condition is answered here, as D-243-09 demands:**
  the two candidate criteria were **3** and **5**, and **both were reachable from vitest at the
  mechanism level** — §3 drove the scroll residual RED on the real hook with real geometry, and
  §6a/§6b drove the navigation path through the provider's own callbacks and reconcile. ⇒ **No
  criterion here was unverifiable without a live E2E drive. The seed correctly stays deferred.**
  ⚠ The residual risk (synthetic wheel ≠ real wheel) is carried by `BUG-260823-01`'s `re_open_trigger`
  and by UAT row L-2, **not** by re-opening the seed.

### 4. `StreamingNarration.tsx` — zero production callers, retirement owed not taken — **verified**

- File is **byte-identical** (`git diff --stat` empty). ✓
- Production callers: **0** — verified by opening every hit. `MessageItem.tsx:449` is inside a **JSX
  comment** preserving the original arm; the `import` is gone; the remaining hits are its own suite,
  two docblock mentions and two `StreamsProvider` comments. ✓
- Recorded in `deferred-items.md` with the constraint *"⛔ whoever takes it must NOT re-mount it on the
  live answer path — that re-opens `BUG-260707-03` exactly as it stood."* ✓
- ⚠ Two stale `StreamsProvider.tsx` comments (`:2151`, `:2615`) still describe *"StreamingNarration's
  fold gives way to a clean answer"* — a description of a fold nothing renders. Left alone on purpose
  (`StreamsProvider` is G-5-firing and `243-05` modified it not at all). Recorded.

### 5. `Plan04.frontend.test.tsx` — inherited red, and **it needs a register entry of its own**

**Re-driven by this verification, not read off the note:**

```
npx vitest run src/__tests__/components/Plan04.frontend.test.tsx --maxWorkers=2
 Tests  1 failed | 7 passed (8)
 AssertionError … expect(node!.className).toContain(cls)   // - text-emerald-400
```

- `grep -c "Plan04.frontend" scripts/vitest-count-gate.cjs` → **0**. In **neither** knob. The phase's
  `count gate OK` never saw it and structurally never could.
- Cause recorded in `deferred-items.md`: `text-emerald-400` moved when **Phase 227-02 decomposed
  `ToolCallPanel`**; the suite (last touched at Phase 095-05) was never re-aimed. **Orphaned for
  ~16 phases behind a green verdict line.**

**Answer to the question asked: YES, it needs one.** `deferred-items.md` is written by the executor and
**read by nothing** — no milestone sweep, no `/gsd:new-milestone` grep, no gate. `SEED-056` names
`Plan04` but only as a member of the June 2026 rot cluster; it does **not** carry the 2026-09 orphaning
cause, and its `trigger_when` is about baseline counts rather than unpinned suites. **The right home is
`SEED-222`** (*"five gate suites run and guard nothing"*), which is exactly this shape, one file over —
append the finding there, or plant a seed. Left as-is, this observation dies with the phase folder.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | `TBD` / `FIXME` / `XXX` | — | **None.** Scanned all seven source files. |
| — | — | stub returns / empty handlers | — | **None.** `ThinkingBlock`'s `return null` at `:193` is the documented state-3 self-guard, fenced by §7. |

---

## ⚠ Warnings — none blocks the goal; all are register hygiene or judgement

| # | Finding | Kind | Why it matters |
|---|---|---|---|
| **W-1** | `REQUIREMENTS.md` **CHAT-02** and **CHAT-03** were not updated by `243-03`. Both still `[ ]` with **no status note**, and CHAT-02's prose still asserts *"`lib/throttle.ts` … wired only to the cache writer, never to the UI path"* — refuted by `throttle.ts:70` + the delta path. Mapping-table rows still read bare *"Pending"*. | MECHANICAL | **A register that now contradicts the code.** CHAT-01/04/05 all got careful annotations; these two were missed. This is the phase's own recurring finding, committed inside the phase. Cheap to fix. |
| **W-2** | `ROADMAP.md`'s `243-03` plan line got `[x]` but **no `✅ DONE` annotation with commits**, unlike the other four. | MECHANICAL | A reader scanning the ROADMAP sees four documented plans and one bare tick on the phase's most consequential plan. |
| **W-3** | `STATE.md` frontmatter reads `completed_plans: 4` while all five are `[x]` in the ROADMAP and five SUMMARYs exist. `completed_phases: 0`, `percent: 0`. | MECHANICAL | Machine-readable progress disagrees with the prose in the same file. |
| **W-4** | `Plan04.frontend.test.tsx`'s orphaning is recorded **only** in a phase-local `deferred-items.md` that nothing sweeps. | MECHANICAL | See §5 above. Route to `SEED-222`. |
| **W-5** | `StreamingNarration.tsx`'s zero-caller retirement is likewise **only** in `deferred-items.md`; plus two now-false comments at `StreamsProvider.tsx:2151, :2615`. | MECHANICAL | Same sweep gap. A component that is *covered* while *unmounted* is `192.2-06`'s `SketchLibraryCard.tsx` shape. |
| **W-6** | ⭐ `2a988c3de` (`243-04`) rewrote **`StreamsProvider.tsx` whole-file CRLF → LF** (8,705 lines churned for ~55 real). **Declared** in `243-04-SUMMARY.md:511-517` with the cause (the file was the lone CRLF blob among 962 tracked frontend files; `autocrlf` strips on add). ⚠ **The consequence was not named:** `git blame` on lines 3000-3010 now attributes **11/11 to `2a988c3de`** — the whole authorship history of the largest file in the frontend tree is shadowed behind one commit unless a reader knows to pass `-w` / `--ignore-rev`. | MECHANICAL | Not a defect; a real archaeology cost on a G-5-firing file, on a project whose ledger recipe depends on `git log`/`blame` archaeology. Worth an `.git-blame-ignore-revs` entry. |
| **W-7** | Two differences from the acceptance bar (**D-2** measured-overflow vs `chars<700`; **D-3** the live accent + animated dots not ported) are declared **in code only**, not in `243-VALIDATION.md` beside D-1. | JUDGEMENT | `243-VALIDATION.md`'s own rule: *"a declared difference from the bar is a decision, an undeclared one is drift."* Both are defensible; neither is written where L-6's driver will look. |
| **O-3** | **An observation, not a warning, and it needs an operator's eye.** Removing the narration arm means a live tool-bearing turn now renders the model's **interim narration** (*"Now I'll search the knowledge base…"*) inline as body text — `MessageItem.answerOutOfFold.test.tsx` §1 asserts this deliberately. Sketch 234's **V1 frame shows no narration line at all** (it appears only in the TODAY frame). At the **settled** state the two agree, because the run-end reconcile replaces the blob with the persisted answer; **during the live run the sketch simply does not model this state**. | JUDGEMENT | ⛔ **This is the thing L-1 and M-1 exist to judge.** The alternative was measured and rejected on a sound ground (oscillation + re-hollowing the 227 discharge). Whether narration-inline reads as *calm* is an operator call and nothing in this phase can answer it. |

---

## Guardrails

| Rule | Fires? | Disposition |
|---|---|---|
| **G-2** sketch before plan for UX | ✅ fired | **DISCHARGED** — sketches 234 V1 and 235 B, operator-approved 2026-09-11. The mockup FILE was opened for this verification, not a description of it. |
| **G-4** lived-experience UAT | ✅ fired | ⛔ **OWED IN FULL.** Rows authored at scope time (correct); **zero driven**. |
| **G-5** refactor between feature waves | ✅ fired on 4 files | `RunCard.tsx` **DISCHARGED by deletion** (measured). `MessageItem.tsx`'s 227 discharge **not re-hollowed** (measured). `StreamsProvider.tsx` / `MessageList.tsx` honoured by construction. Both ledger gates exit 0. |
| **G-7** gap-closure round cap | not fired | Initial verification; zero gap-closure rounds. |
| **G-8** plan-count proportion | not fired | 5 plans, inside the 3-5 band. |

---

## Gaps Summary

**There are no gaps.** All five ROADMAP success criteria are achieved in the shipped code, every one
checked by opening the file or running the command rather than by reading a SUMMARY. The phase goal —
*one calm, structured surface instead of a monospace blob repainted once per token, and a product that
leaves a scrolled-up reader where they are* — is **delivered at the mechanism level**:

- the blob is gone (four classes dropped, real paragraphs, a cap-with-a-reveal instead of a nested
  scrollbar), and it is now drawn by **one** component for **both** message shapes, so the 31% of
  reasoning that had nowhere to go now has a home;
- the repaint no longer tracks the token (60 deltas → ≤14 scrolls, losslessly, with the leading edge
  preserved so the first character is not delayed);
- a reader who says *"leave me here"* is left there, by a fix that was **driven RED before it was
  written** and that refuted the bug report it would otherwise have been written against;
- and the answer can no longer be written inside a fold, because the fold's arm is deleted.

**What is missing is not code. It is the browser.** Not one of the twenty UAT rows this phase authored
at scope time has been driven, and three of the five criteria have a lived half that no synthetic fence
can reach — the flicker perception, the real-wheel scroll, and the side-by-side against the mockup.
**Closing here is legitimate; calling it verified-in-full would not be.** That is why `status` reads
`human_needed` and not `passed`, and why three bug reports correctly remain `folded`.

⛔ **And the standard this phase set for itself applies to this document too: this is a
SELF-VERIFICATION.** Every MECHANICAL row above stands on its own — a command's exit code and a file's
bytes do not care who read them. Every **JUDGEMENT** row (D-2, D-3, W-7, O-3, and the question of
whether V1's paragraphs *feel* like the calm surface the goal asks for) is a single pair of eyes, and
would be worth a second.

---

_Verified: 2026-09-11T02:58:20Z_
_Verifier: Claude (gsd-verifier) — **self-verified**, no independent reviewer (OV-SOLO-01 / D-243-12)_

---

## ✅ STATUS FLIPPED TO `passed` — 2026-09-11, after the browser was opened

This file was written `human_needed` for one stated reason: **5/5 criteria were verified
mechanically and 0/20 UAT rows had been driven.** That is no longer true.

**Driven, in a real browser, on a purpose-seeded 60-message thread:**

| Row | Result | The evidence that settles it |
|---|---|---|
| **L-2** scroll survives a tool call | ✅ | **real wheel**; anchor drift **0 px** / 257 samples / ~25 s; **0** app `scrollIntoView` calls since release |
| **L-3** reasoning with no tools | ✅ | DB: `tools = 0 · reasoning = 645 chars`; the fold renders in the message body |
| **L-4** navigate away and back | ✅ | `navigation.type === "navigate"` (**no reload**); **0** `StreamingNarration` nodes; answer rendered |
| **L-5** the 170× spread | ✅ | real corpus extremes (**33,279** rendered / 136 `<p>` clamped; **202** unclamped); **3 controls for 3 clamped bodies** |
| **L-6** settled frame vs the bar | ✅ | **9/9** on V1's diff table, from computed style |
| **L-1** flicker | ◐ | **owed** — failed twice on harness mechanics, never on the product |
| L-6 live frame · cross-provider ×8 | ⛔ | **owed** — see `243-UAT-RESULTS.md` |

**Registers closed on that evidence:** `BUG-260823-01` **closed** (its `re_open_trigger` named a
real-wheel row and L-2 supplied it) · `BUG-260707-03` residual #2 **closed** · `BUG-260718-02` stays
**`folded`**, part B explicitly open on L-1. **CHAT-01..05 all tick.**

⚠⚠ **`passed` does NOT mean everything ran.** It means **every ROADMAP success criterion is true and
demonstrated**, with the remainder recorded as a decision in `243-UAT-RESULTS.md` — the cross-provider
board **attempted and abandoned** because the driver could not verify which provider a row actually
used, L-1 owed, and L-6's live frame owed.

⚠ **This is still a SELF-verification** (`OV-SOLO-01`). The mechanical evidence above — a driven
fence, a byte-identical file, a measured count, a navigation type — is not weakened by that. **The
judgement calls are**, and they are named in §6 of this file and in the summaries.

⭐ **The browser earned its place three times**: it found `BUG-260911-02` (which no fence in this
phase could reach), it found L-6's order divergence, and it corrected my own L-2 method — `scrollTop`
said FAILED twice before an anchor measurement said 0 px.
