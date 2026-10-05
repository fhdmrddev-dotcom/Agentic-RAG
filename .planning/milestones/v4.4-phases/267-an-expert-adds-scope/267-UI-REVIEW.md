# Phase 267 — UI Review

**Audited:** 2026-09-26 (retroactive, advisory)
**Baseline:** `267-UI-SPEC.md` (approved 2026-09-25) + sketch 267 Variant B (acceptance bar, D-267-27)
**Screenshots:** not freshly captured. The dev server answered on :5173, but the app needs a signed-in session that a CLI
Playwright capture does not have. The audit uses the operator's live G-4 evidence instead:
`evidence/g4-00`, `g4-02a`, `g4-02b`, `g4-03a`, `g4-03b`, `g4-04a` (1804×915, **light theme**).
**Known observation, not re-litigated:** O-1 — the swap card's `Dropped` line lists thread-folder files that the previous
restricted Expert was not using either.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Every contract string is present and exact. Leftover generic and jargon strings remain on the rows this phase rewrote, and one error path doubles its own words |
| 2. Visuals | 2/4 | After a swap, the transient spotlight card is the largest thing on screen and pushes the persisted event card into second place. The 380px list shows about one ledger row at a time |
| 3. Color | 2/4 | The phase hardcodes dark-theme palette steps with zero `dark:` variants. On the light theme the operator actually used, the event header and the SC#2 gate line fall to roughly 1.3:1 and 1.9:1 |
| 4. Typography | 3/4 | New elements stay within 11/12px and weights 400/600 as declared. Only small drift: line-height on keys, and one 11px sub-line not in the spec |
| 5. Spacing | 3/4 | Every value is on the declared scale or is a declared exception. The spec's premise about the transcript's 16px rhythm is wrong, and the event wrapper uses 8px |
| 6. Experience Design | 3/4 | Loading, error, retry, in-flight lock, "no dead buttons" and empty states are all covered. Three weaker points: the Active status is drawn as a button, overlapping changes can revert wrongly (IN-08, deferred), and the gate literal is styled three different ways |

**Overall: 16/24**

---

## Top 3 Priority Fixes

1. **BLOCKER: the phase's semantic colours are illegible on the light theme.** Measured WCAG contrast against the light surfaces:
   - `text-violet-200` event header ≈ **1.3:1**
   - `text-emerald-300` `Now` value ≈ **1.5:1**
   - `text-rose-300` `Requires … — not connected` ≈ **1.9:1**

   The spec's §4 claim ("both above 4.5:1") was measured only against the dark `--card`. The app ships a light `:root`
   theme and a user toggle (`ProfileMenu.tsx:173`), and every G-4 screenshot was taken in light mode.
   - **Where it shows:** in `g4-02b` the words `Financial Analyzer → HR Advisor` can barely be seen. In `g4-03b`,
     `Contract Reviewer · new chat` can barely be seen.
   - **Why it matters:** the header is the only thing that tells a swap from a removal. §4 relies on it for "never
     colour alone", so the WCAG 1.4.1 guarantee fails exactly where the spec leaned on it.
   - **Where to fix:** `ExpertEventCard.tsx:70`, `:96`, `:128`, `:176`; `InviteExpertDialog.tsx:226`, `:253`;
     `ExpertCard.tsx:179`; `ExpertDetailModal.tsx:162`.
   - **Fix:** pair every step with a light-theme step, for example `text-rose-700 dark:text-rose-300`,
     `text-emerald-700 dark:text-emerald-300`, `text-violet-700 dark:text-violet-200`. Better still, add semantic
     tokens `--will` / `--wont` / `--expert` to both `:root` and `.dark` in `index.css`, so the reserved-violet and
     will/won't roles each have one home.

2. **WARNING: after a swap the transcript announces the change twice, and the louder announcement is the one that
   disappears.**
   - **What happens:** `ChatArea.tsx:977-985` mounts `ExpertSpotlightCard` below the list whenever `expertInvited` is
     set. In `g4-02b` that card is about 330px tall and sits directly under the 160px persisted `ExpertEventCard`.
   - **Why it is worse on light:** the spotlight's styling is dark-only (`ExpertSpotlightCard.tsx:143`:
     `from-violet-950/40 to-slate-900/60`, `bg-white/5`). On light it renders as a muddy grey-violet slab with
     barely readable body text.
   - **Why it matters:** the persisted record, which is the PACK-23 deliverable, is visually outranked by the
     transient one.
   - **This is the case the spec anticipated.** §9-D6 says: "If the operator reads it as a double announcement at
     G-4, removing the transient card is a one-condition change."
   - **Fix:** skip the transient mount when the thread already has messages, so the event card owns mid-thread
     changes. Keep the spotlight for empty threads and the catalog door only. Separately, give the spotlight light-theme
     surfaces.

3. **WARNING: the invite dialog's list viewport is sized for the pre-ledger rows.**
   - **What happens:** `InviteExpertDialog.tsx:505` keeps the shipped `max-h-[380px]`. A restricted row with a
     `Will use` / `Won't use · 4` ledger is about 360px tall (`g4-02a`), so the dialog shows one row plus a sliver of
     the next.
   - **Why it matters:** the R7 decision (Replace or New chat) and every other Expert sit below the fold behind a
     thin scrollbar. The ledger this phase added is exactly what pushed them there.
   - **Fix:** raise the cap to `max-h-[min(60vh,560px)]` (the dialog is already `max-w-lg`). Or render the full
     ledger only on the active row and on the row being evaluated, with a one-line summary
     (`Won't use · 4 of this chat's documents`) on the others. Both preserve the at-rest wording.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**Contract met (verified string by string against §7):**
- `CONNECTION_COPY` (`expertCatalog.ts:162-173`), `LEDGER_COPY` (`:181-193`) and `EVENT_COPY` (`expertEventCopy.ts:48-67`)
  carry every declared literal: the em dash, U+00B7 in `Won't use · N`, curly quotes in `Handed off from “…”`,
  `Chat attachments stay readable.`, and `Nothing`.
- The false dialog description ("scopes document search and tools") is gone. `This chat · /Client ACME` and
  `This chat · All your documents` render as specified (`g4-02a`, `g4-00`).
- The empty-state and list-error copy was upgraded as §7.4 asked (`expertCatalog.ts:411`, `:413`).

**Findings:**
- **WARNING** `InviteExpertDialog.tsx:426` + `expertCatalog.ts:413`: when the error is not an `Error`, the reason
  falls back to `"Failed to load experts"`, so the box reads **"Couldn't load Experts. Failed to load experts"**. The
  prefix §7.4 added now stutters. Replace the fallback with a reason sentence such as
  `The server could not be reached.`, reusing `PREVIEW_COPY.networkReason`.
- **WARNING** `InviteExpertDialog.tsx:570`: the fallback description `"Specialized domain assistant with scoped
  access."` is generic filler. After D-267-01, "scoped access" is also the same kind of claim the phase removed from
  the header. Render nothing, or `No description yet.`
- **WARNING** `InviteExpertDialog.tsx:590`: the meta token `"{n} conn"` is a truncated jargon abbreviation next to
  `1 folder` / `1 skill`. It should read `1 connection` / `2 connections`.
- **WARNING** `g4-04a` Drive Briefing card: the literal says the same thing twice. The `Missing: Google Workspace`
  cell is directly followed by `Requires Google Workspace — not connected`. §9-D3 records this as deliberate (the
  literal the verifier greps for). With `Brings` empty (see Visuals), the card spends about 100px on one fact.
  Advisory: keep the line and let the `Missing` cell carry only the service name. That is already true, so the fix is
  visual weight, not wording.
- Informational: §5.7's `{title} · deleted` was retired by 267-REVIEW WR-09 (`ExpertEventCard.tsx:166-169`). The
  reason is sound and recorded in the code, so this is not a defect.

### Pillar 2: Visuals (2/4)

**What works:**
- Variant B's anatomy is faithfully reproduced: two-column ledger cells, the `Now` / `Dropped` grid card with a mono
  timestamp, the `Here` / `Open` pointer, and the left-barred handoff card (`g4-02a`, `g4-02b`, `g4-03a`, `g4-03b`).
- The handoff card (`g4-03a`) is the strongest surface in the phase: clear primary bar, legible bullets, and nothing
  extra.

**Findings:**
- **WARNING** Double announcement after a swap (`ChatArea.tsx:977`, `g4-02b`). See Top fix #2. The focal point on
  the post-swap screen is the transient card, not the record.
- **WARNING** Dialog viewport (`InviteExpertDialog.tsx:505`). See Top fix #3.
- **WARNING** `InviteExpertDialog.tsx:222-230`: the R1 `Active` status is drawn with the button class `BTN` (padding,
  rounded-lg, border, fill) in the button's position. In `g4-02a` it reads as a disabled button with invisible text.
  IN-02 correctly made it a non-control, but it still *looks* like one, which is the "button that does nothing" the
  spec forbids, in visual form. Restyle it as a pill (`rounded-full px-2 py-0.5 text-[11px]`, like the scope badge)
  or as a check plus the plain text `Active here`.
- **WARNING** `expertCatalog.ts:273`: `Brings` is dropped when empty. The Drive Briefing card (`g4-04a`) therefore
  shows a lone full-width rose `MISSING` cell, and the sketch's two-sided statement collapses into an alarm box.
  Honest absence is defensible, but the result is a heavier visual weight than the Restricted/Biased cards beside it.
  Advisory: when `Brings` is empty on the card, render `Brings: Nothing yet` muted (the `Nothing` vocabulary already
  exists) to keep the sketch's pair.
- Informational: `ExpertEventCard` icons are correctly `aria-hidden`. The spotlight dismiss has
  `aria-label` (`ExpertSpotlightCard.tsx:201`). No unlabeled icon-only control was found in the phase's surfaces.

### Pillar 3: Color (2/4)

**Accent distribution against §4:**
- Reserved violet appears only on the declared elements: event border and wash, the `Sparkles` / `ArrowUpRight`
  glyphs, dialog gem, active row, and the Expert icon gems.
- No violet button, link, ledger column or error. The `Open →` link and `Connect …` buttons use `primary`, as
  declared.
- **The 60/30/10 structure passes.**

**Findings:**
- **BLOCKER** Light-theme contrast. See Top fix #1.
  - `grep -c "dark:"` returns **0** across all six phase files. `index.css:17` defines a light `:root`
    (`--background: 220 20% 97%`), and `.dark` begins at `:115`.
  - The sketch is dark-only (`index.html:11`, `--bg:hsl(216 45% 4%)`), so nobody ever looked at these tones on a
    light surface.
  - Affected phase-new sites: `ExpertEventCard.tsx:70` (header `violet-200`), `:96` (`emerald-300` / `rose-300`
    values), `:128` / `:176` (`violet-300` glyphs); `InviteExpertDialog.tsx:226` (`Active`, `violet-200`), `:253`
    (gate line `rose-300`); `ExpertCard.tsx:179` (gate line); `ExpertDetailModal.tsx:162` (missing pill).
- **WARNING** The same root cause affects inherited, unchanged elements on the same screens:
  - the `Restricted` / `Biased` badges (`InviteExpertDialog.tsx:561-562`, `ExpertCard.tsx:155-156`);
  - the composer's `USING:` chip, whose Expert name is invisible in `g4-02b` / `g4-03a` / `g4-03b`;
  - the spotlight card.

  These are not 267's defects, but 267 put its PACK-23 record right beside them. Fix them in the same token pass.
- **WARNING** One literal, three treatments. `Requires … — not connected` is:
  - `text-rose-300` on the card (`ExpertCard.tsx:179`) and in the dialog (`InviteExpertDialog.tsx:253`);
  - `text-xs italic text-muted-foreground/90` in the modal footer (`ExpertDetailModal.tsx`, the `FooterLine` at
    `:135`).

  §5.5 does specify `FooterLine`, so this matches the contract. The result is still that the one PACK-22 fact changes
  weight between two views of the same Expert. Pick one.

### Pillar 4: Typography (3/4)

**Distribution in the phase's new and changed files** (`InviteExpertDialog`, `ExpertEventCard`, `HandoffCard`,
`ScopeLedger`, `ExpertCard`):

| Size | Count |
|---|---|
| `text-xs` | 21 |
| `text-[11px]` | 11 |
| `text-[10px]` | 4 (all shipped scope badges, unchanged) |
| `text-sm` | 2 |
| `text-base` | 1 |

Weights: `font-semibold` ×8, `font-medium` ×2 (both the shipped button class, the declared exception). **This matches
§3: new elements introduce only 11 and 12px, and only weights 400 and 600.**

**Findings:**
- **WARNING** `ExpertEventCard.tsx:86`: event keys use `leading-relaxed`, while §3 declares the Label role as
  `leading-snug`. The ledger heading (`ScopeLedger.tsx:64`) uses `leading-snug`, so the same Label role is drawn two
  ways. The effect is invisible in a grid row, but the role is not held.
- **WARNING** `ExpertEventCard.tsx:188`: the D-267-33 `Same folder: /{name}` sub-line is 11px sans. A folder path
  elsewhere in the phase is `font-mono` (dialog context line `:496`, the event sub-line `:140`, spec §1: "JetBrains
  Mono: … the dialog's folder path"). Make it `font-mono` for consistency.
- Informational: the §9-D1 deviation (11px, not the sketch's 10px, for ledger headings) is honoured
  (`ScopeLedger.tsx:64`).

### Pillar 5: Spacing (3/4)

**Declared scale honoured.**
- The ledger uses `gap-2 mt-3`, cells `px-3 py-2`, and lists `space-y-1` (`ScopeLedger.tsx:56`, `:68`, `:108`).
- The event card uses `px-3 py-3`, `mt-2`, `gap-x-3 gap-y-1` (`ExpertEventCard.tsx:60`, `:79`).
- The handoff card uses `p-3`, `mt-2`, `space-y-1` (`HandoffCard.tsx:22`, `:29`).

All arbitrary values are declared in the spec: `rounded-[10px]`, `border-l-[3px]`, `min-h-[44px]`, `max-w-[20ch]`,
`bg-emerald-500/[0.08]`. No 2, 6, 10 or 14px value was introduced by a new element. The `px-3.5` on the modal primary
button predates 267 (`119690741`).

**Findings:**
- **WARNING** Spec premise vs. code. §2 says the 16px transcript rhythm is "the `MessageList` gap already in use", but
  `MessageList.tsx:234` is `space-y-1` (4px). The event card's actual separation is its own `py-2` wrapper
  (`MessageItem.tsx:337`), which gives 8px + 4px + 8px. `g4-02b` shows the event card crowding the spotlight below it.
  Either correct the spec, or give the event wrapper `py-4` so it matches the declared lg rhythm.
- **WARNING** `HandoffCard.tsx:19` wraps its card in `py-2` independently, not through the same wrapper as the event
  card. The two siblings use one value today, but through two homes.
- **WARNING** `InviteExpertDialog.tsx:308-311`: the R7 active line is `mt-3` and the buttons are `mt-2`, as declared.
  But when the ledger (`mt-3`) comes first, the row stacks 12 + 12 + 8px of separators, and the row grows to about
  400px. This feeds Top fix #3.

### Pillar 6: Experience Design (3/4)

**State coverage verified in code:**
- **R4 loading:** `role="status"` with Loader2, and no invite control until the cost is stated
  (`InviteExpertDialog.tsx:171-184`).
- **R5 error:** `role="alert"` plus a row-scoped `Try again` (`:186-202`).
- **D5 zero-folder gate line:** `:203-213`.
- **R3 connection gate:** Connect is rendered only when `gate.action` is set, otherwise the member ask, never a
  disabled button (`:256-270`).
- **R9 in-flight handoff:**
  - a synchronous ref lock (`:376`, `:445`);
  - sibling rows `aria-disabled` with no-op handlers (`:156-160`);
  - the dialog cannot be dismissed while in flight (`:439-442`);
  - `aria-busy` (`:329`).
- **R10 refusal:** ends with `Nothing was created.` (`:461-467`).
- **Catalog `Starting…`:** a double-click guard (`ExpertCard.tsx:236-250`).
- **Removed tool-floor controls:** removed, per §6.5.
- **No confirm step:** correct per §6.2 / §7.5.

**Findings:**
- **WARNING** The R1 `Active` status looks like a disabled button (see Visuals). For a keyboard or screen-reader user
  it is correctly not focusable, but for a sighted user it is a control-shaped thing that does nothing.
- **WARNING** Carried risk, already recorded and deferred: `267-REVIEW.md` IN-08 says overlapping Expert changes can
  revert wrongly (no in-flight ref on the PATCH path). The event card makes the result visible, but two quick
  Replace clicks from two open dialogs could still write events that disagree with the final chip. The handoff path
  already has the ref pattern to copy.
- **WARNING** `InviteExpertDialog.tsx:436`: previews are keyed to `open` only (the eslint-disable is deliberate). If
  the thread's folder changes while the dialog is open (a sidebar drag, say), the ledger stays stale until the dialog
  is reopened. That is low likelihood, and §5.3 accepts "not cached across openings". Recorded, not scored.
- Informational: O-1 (the `Dropped` line over-states the loss for a restricted→restricted swap) is visible in
  `g4-02b`. It is not re-litigated here.

---

## Sketch acceptance bar (Variant B): does anything contradict it?

**Layout and labels: no contradiction.**
- `Brings` / `Missing`, `Will use` / `Won't use · N`, the timestamped `Now` / `Dropped` card, `Replace <active>` /
  `New chat with <Expert> →`, `<active> is active here.`, and `Here` / `Open →` are all rendered exactly as in the
  sketch.
- The only departures are those recorded in §9: D1, D2 (no disabled invite), D3 (the added gate line) and D6/D8.
- The ⛔ one-payload build obligation holds:
  - `previewLedgerColumns` reads `excluded_count` and the names from one response (`expertCatalog.ts:438-460`).
  - `connectionLedgerColumns` builds both sides from one `connection_state` array (`:259-276`).

**Two places where the implementation departs from the sketch's intent without being recorded:**
1. **Theme.** The sketch was judged on Deep Midnight only. On the light theme, the header words that carry the
   swap/removal meaning, and the will/won't tones, lose the legibility the operator approved. This is Top fix #1.
2. **Visual hierarchy.** The sketch's event card is the persisted, primary record. Live, it sits under a larger
   transient spotlight (`g4-02b`). This is the §9-D6 trigger condition.

---

## Registry Safety

The shadcn setup is initialised, and UI-SPEC §10 lists **no third-party registries** and no new blocks. Registry
audit: 0 third-party blocks checked, no flags.

---

## Files Audited

- `.planning/phases/267-an-expert-adds-scope/267-UI-SPEC.md`
- `.planning/sketches/267-an-expert-adds-scope/README.md`, `index.html` (theme tokens)
- `.planning/phases/267-an-expert-adds-scope/evidence/g4-00`, `g4-02a`, `g4-02b`, `g4-03a`, `g4-03b`, `g4-04a` (`.png`)
- `.planning/phases/267-an-expert-adds-scope/267-REVIEW.md`, `267-VERIFICATION.md`, `267-UAT-LOG.md` (grep only)
- `frontend/src/components/chat/InviteExpertDialog.tsx`
- `frontend/src/components/chat/ExpertEventCard.tsx`
- `frontend/src/components/chat/HandoffCard.tsx`
- `frontend/src/components/chat/expertEventCopy.ts`
- `frontend/src/components/chat/ExpertSpotlightCard.tsx` (classes)
- `frontend/src/components/chat/ChatArea.tsx` (the spotlight mounts)
- `frontend/src/components/chat/MessageItem.tsx:328-343` (the event mount)
- `frontend/src/components/chat/MessageList.tsx:234`
- `frontend/src/components/experts/ScopeLedger.tsx`
- `frontend/src/components/experts/catalog/ExpertCard.tsx`
- `frontend/src/components/experts/catalog/ExpertDetailModal.tsx` (pill, header, footer)
- `frontend/src/components/experts/catalog/expertCatalog.ts` (copy constants and ledger selectors)
- `frontend/src/index.css` (the `:root` and `.dark` tokens)

---

## Fix outcomes (orchestrator-requested)

Top 3 only, fixed 2026-09-26. Commits: RED `abbb1618d`, GREEN `09bdb3e9e`, gate adoption `5c260e6da`. Each RED case was
driven failing on the unfixed tree before the fix landed (7 failed, control G14 passed).

**#1 BLOCKER, light-theme contrast. FIXED.** It follows the repo's existing pairing pattern (`text-amber-700 dark:text-amber-300`
in `SourceToolsCard.tsx`, `text-emerald-600 dark:text-emerald-400` in `McpAuthDoor.tsx`). No new tokens were added
to `index.css`. The dark classes are unchanged, so Deep Midnight renders exactly as before.
- **Text:** `text-{violet,emerald,rose,amber}-{200,300}` → `text-<hue>-700 dark:text-<hue>-{200,300}`.
- **Icons:** `text-violet-400` → `text-violet-600 dark:text-violet-400`.
- **Ledger borders:** `border-<hue>-500/25` → `border-<hue>-600/40 dark:border-<hue>-500/25`, so the columns
  no longer vanish on white.
- **Sites:** `ExpertEventCard.tsx` (the header, the Now/Dropped values, both glyphs), `InviteExpertDialog.tsx` (the
  Active pill, the gate line, the dialog gem, and the row icons), `ExpertCard.tsx` (the gate line and meta icons),
  `ExpertDetailModal.tsx` (the missing pill and the in-scope pill), and `ScopeLedger.tsx` (the borders).
- **Inherited sites, fixed in the same pass:** the Restricted/Biased badges and the Expert gems, in
  `InviteExpertDialog`, `ExpertCard` and `ExpertDetailModal`.
- **Unchanged:** `HandoffCard.tsx` already used tokens (`text-primary`, `text-foreground`). The composer `USING:` chip
  and `ExpertSpotlightCard`'s dark-only surfaces are **still open**. They are outside the six files, and 267 did not
  add them.
- **Fence:** `frontend/src/components/chat/__tests__/expertThemeContrast.test.tsx` has 6 cases.
  - It checks the rendered class pairs on the event card and the ledger.
  - It runs a source fence over the six files: no bare 50–400 hue step may appear anywhere, and every
    `dark:text-<hue>-N` needs a 600–900 companion on the same line. A non-vacuity floor requires ≥ 8 pairs.

**#2 WARNING, double announcement. FIXED.**
- **Change:** the mid-thread `ExpertSpotlightCard` mount in `ChatArea.tsx` is removed.
- **Why removal, not a guard:** that branch renders only when the thread has messages. A change made there always
  writes the persisted `expert_changed` event, which `applyExpertChange` refetches. A `messages.length === 0` guard
  inside that branch could never be true, so it would have been dead code.
- **What remains:** the empty-thread spotlight (D-267-12) is untouched.
- **Knock-on:** `expertInvited` had no reader left, so its `useState` and its four setters are removed. This takes the
  file's `useState` count down by 1.
- **Tests:** `ChatArea.expertThread.test.tsx` (G13) checks that a swap on a thread with messages mounts no spotlight
  (RED on base). (G14) is the control: an invite on an empty thread still shows it.

**#3 WARNING, list height. FIXED.**
- **Change:** `max-h-[380px]` → `max-h-[min(78vh,720px)]` on the list, which now has `data-testid="invite-expert-list"`.
- **Why 78vh:** on a 900px viewport the list gets 702px, and with the dialog chrome (~124px) the dialog is ~826px, so it
  still fits.
- **What you see:** 702px shows the first ledger row whole and most of the second. Previously it showed one row plus
  a sliver.
- **Limitation, stated honestly:** two *full* ~360–400px ledger rows plus the dialog chrome cannot fit in 900px at any
  cap. The review's alternative (full ledger only on the active and evaluated rows) is **not** taken.
- **Test:** `InviteExpertDialog.test.tsx` (U3) asserts the class.

**Gates:**
- `npx tsc -p tsconfig.app.json --noEmit`: **70 errors** (unchanged, none in touched files).
- Targeted suites: 15 files / 236 tests passed.
- `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`:
  ```
  total 8978  ·  failed 0  ·  pinned total 8230
  count gate OK — 337/337 pinned files present, no per-file decrease, 0 failing.
  ```
- Pins: `expertThemeContrast.test.tsx` was adopted into both knobs at 6. InviteExpertDialog went 22→23, and
  ChatArea.expertThread 16→18.
- The five unrelated `— N new` suites (`PromptVariableChips`, `RunHero`, `automationFacts`, `nodeEffectBanner`,
  `toolReadOnlyMap`) are not this fix's, and are left unpinned.
