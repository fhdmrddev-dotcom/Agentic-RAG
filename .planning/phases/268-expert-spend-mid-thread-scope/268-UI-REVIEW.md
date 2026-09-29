# Phase 268 — UI Review

**Audited:** 2026-09-29
**Baseline:** `268-UI-SPEC.md` (design contract, approved)
**Screenshots:** captured — reused from the operator-approved live G-4 Chrome UAT evidence (`evidence/g4-*.png`, light + dark), supplemented by source-code audit against the spec's declared tokens. The dev server was up at `localhost:5173` during this audit but requires an authenticated session and realistic fixture data (folders, Experts, spend history) that only exist in the operator's org; the G-4 evidence already covers exactly the states the spec calls out (S1/S2 chip, P2/P3 picker, normal/held card, Spend by Expert filtered/unfiltered, both themes), so it was used as primary visual evidence rather than re-driving an unauthenticated instance.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Every string in `scopeCopy.ts` / `expertSpendCopy.ts` matches §7 verbatim, fenced by unit tests; live screenshots confirm exact rendering |
| 2. Visuals | 3/4 | O-1 (already recorded in UAT-LOG): the picker's `Next message searches` / `Saved` ledger items truncate with only a `title` tooltip — violating the spec's own §8.1 "never hover-only" rule for exactly the content type (folder paths) most likely to be long |
| 3. Color | 4/4 | Indigo, amber, emerald, rose all confined to their §4.2/§5.8 reserved elements; zero bare 50–400 hue steps without a `dark:` pair found in any of the 5 new leaves |
| 4. Typography | 3/4 | `ExpertSpendCard.tsx:164`'s new table header uses `font-medium` (500) where §3 explicitly rules the new table's headers must be 600, "not the shipped 11px/500 `th`" |
| 5. Spacing | 3/4 | 6 occurrences of a new 6px value (`px-1.5`/`py-1.5`/`ml-1.5`/`mt-1.5`) across 3 files, directly against §2's "No new element introduces a 2px, 6px, 10px or 14px value of its own" |
| 6. Experience Design | 3/4 | Excellent state coverage (loading/error/empty/refusal/aria-busy/keyboard/mobile) verified live on both themes; but the phase's own live proof found the picker's promise ("Applies from your next message") did not hold for 6/8 providers pre-fix, and 2/8 remain unmeasurable post-fix (F-1/SEED-319) — a real gap in the feature's cross-provider honesty, even though it was found, disclosed and mostly fixed within the phase |

**Overall: 20/24**

---

## Top 3 Priority Fixes

1. **Picker ledger truncates the folder path with no visible fallback (O-1)** — a user opening the scope picker on a nested folder (e.g. `/Client ACME/Q3 Contr…`) cannot read the full path without hovering, which is exactly the "hover-only" pattern UI-SPEC §8.1 was written to forbid ("A `title` attribute never counts as the visible copy") — **fix:** widen the ledger column, drop to a 2-line wrap for the item text instead of `truncate`, or shrink the item font by one step; already recorded as a known, non-blocking follow-up in `268-UAT-LOG.md`, but it is a genuine spec self-violation and should not be left indefinitely.
2. **Spend-by-Expert table header weight is 500, not the declared 600** (`frontend/src/components/admin/spend/ExpertSpendCard.tsx:164`) — UI-SPEC §3 explicitly anticipated and forbade reusing the shipped `th font-medium` for this new table ("The new table's header cells use 11px/600 … because they are a new element"), and the implementation did exactly what the spec pre-emptively ruled out — **fix:** change `font-medium` to `font-semibold` on the `<th>` className.
3. **Six new 6px spacing values across 3 files, against the declared scale** (`ScopePicker.tsx:71` Apply/Cancel/Try-again `py-1.5`; `ExpertSpendCard.tsx:86,197,311` `ml-1.5`/`px-1.5` on the mode tag, unrated chip and sub-agent tag; `AttributionDisclosures.tsx:28,39` `mt-1.5` on both Blind Spots tile bodies) — UI-SPEC §2 states plainly "No new element introduces a 2px, 6px, 10px or 14px value of its own," and none of these six sites are covered by the declared exception list (which only exempts `gap-1.5` on the two chip containers, not `px-1.5`/`py-1.5`/`ml-1.5`/`mt-1.5`) — **fix:** move each to the declared `sm` (8px, `gap-2`/`px-2`/`py-2`/`mt-2`) or `xs` (4px, `gap-1`/`mt-1`) token.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
- `frontend/src/components/chat/scopeCopy.ts` and `frontend/src/components/admin/spend/expertSpendCopy.ts` byte-match UI-SPEC §7.1–§7.4: `Apply` / `Applying…` / `Cancel` / `Try again` / `clear` / `More`, the exact refusal sentence `Couldn't change the folder. {reason} This chat still searches {saved}.`, the exact recon lines (`✓ {k} lines = ${total} = org total · {R} runs, 0 unattributed`), and the rule line verbatim.
- Shared literals are imported, never re-spelled (`EVENT_COPY.allDocuments`, `LEDGER_COPY.chatAttachments`, `UNNAMEABLE_FOLDER`) — confirmed at `scopeCopy.ts:27-29`.
- Live evidence confirms the copy renders exactly as specified: `g4-2-light-after-apply.png` shows `Scope /Client ACME → /Client ACME/Q3 Contracts` / `NOW` / `DROPPED` / `From your next message.`; `g4-3-light-card.png` shows `Saved` / `Searching  HR Policies only · HR Advisor is Restricted` / `Takes effect when HR Advisor leaves.` — both verbatim matches to §7.2/§7.3.
- No generic `Submit`/`OK`/`Click Here` patterns found in any of the 5 new leaves.
- Em dash (`—`), middle dot (`·`) and the arrow (`→`) are used correctly per §7's exact-character contract, confirmed in `expertSpendCopy.ts`.

### Pillar 2: Visuals (3/4)
- Clear focal points: the scope card and the amber held-card read as the transcript's obvious event marker (confirmed in both G4-2 and G4-3 screenshots); the Spend by Expert card sits in the shipped cockpit rhythm without competing for attention.
- Icon-only interactive elements are paired with accessible names: the chip's `aria-label` carries the full state sentence (`ScopeChip.tsx:69-70`), and the picker's Apply/Cancel are `DropdownMenuItem`s with visible text, not icon-only buttons.
- **O-1 (already recorded live, UAT-LOG.md, "not blocking"):** `ScopeLedger.tsx:80-88` renders every ledger item with `className="truncate"` and only a `title` attribute as the fallback for the full text. UI-SPEC §8.1 states explicitly: *"At rest, never hover-only (266 UI-3)… A `title` attribute never counts as the visible copy."* For a short label this never surfaces; for the realistic case the phase itself built as its acceptance fixture (`/Client ACME/Q3 Contracts`), it does — confirmed live in `g4-3-light-picker.png` (`/Client ACME/Q3 Contr…`). This is a genuine, if narrow, violation of the spec's own accessibility promise, not merely an aesthetic nit.
- No other hierarchy or focal-point issues found; the composer chip row gracefully wraps to a second line under combined Expert+Scope chips at narrower widths (confirmed in `g4-3-light-card.png` vs `g4-3-light-picker.png`), which is expected flex behavior, not a defect.

### Pillar 3: Color (4/4)
- Indigo usage grepped across all 5 new leaves resolves to exactly the §4.2/§5.8 reserved set: `ScopeChip` normal state (`ScopeChip.tsx:30`), the picker's selected tree node + Check glyph (`ScopePicker.tsx:70,188`), the Biased explain box rule (`ScopePicker.tsx:249`), the active Expert pill (`ExpertFilterPills.tsx:24`), the selected Spend-by-Expert row + its share-bar fill (`ExpertSpendCard.tsx:181,212`), and the §5.8-declared sub-agent Blind Spots tile icon (`AttributionDisclosures.tsx:25`). No stray indigo on errors, Restricted state, or Expert identity.
- Zero hardcoded hex/`rgb()` colors in any of the 5 new leaves (`grep` returned no matches).
- Zero bare 50–400 hue text steps without a paired `dark:` variant — the §4.3 light-theme contract holds structurally in source, and both theme screenshots (`g4-1-light-spend-fa.png` / `g4-1-dark-spend-fa.png`, `g4-3-light-card.png` / `g4-3-dark-card.png`) show legible contrast on both backgrounds for indigo, amber, emerald and rose.
- Amber is used only for the held/not-searched state (chip suffix, restricted card, `Saved` ledger column) exactly per §4.1; emerald/rose only for `Now`/`Dropped` (`yes`/`no` ledger tones) — confirmed both in code and in the live card renders.

### Pillar 4: Typography (3/4)
- New sizes are exactly `text-[11px]` / `text-xs` (12px) / `text-sm` (14px) — the declared 11/12/14 set, no 4th size found across all 5 leaves.
- Weights are almost entirely `font-semibold` (600) and inherited `font-normal`/unset (400) — the declared 2-weight set — with one exception:
  - **`ExpertSpendCard.tsx:164`**: `<th key={h} className={\`py-2 px-3 font-medium ${...}\`}>` for the Spend-by-Expert table's header cells (`Expert · Runs · Tokens · USD · Share`). UI-SPEC §3's exceptions table addresses this exact element by name: *"The shipped cockpit keeps its... `th font-medium`. This phase changes none of them. **The new table's header cells use 11px/600 (above), not the shipped 11px/500 `th`, because they are a new element.**"* The implementation used the shipped 500 weight the spec pre-emptively forbade for this element.
  - `ScopeChip.tsx:28`'s `font-medium` on the chip's `BASE` class is correctly exempted — the spec explicitly names this reuse ("`ActiveExpertChip`'s container carries `font-medium`... `ScopeChip` copies that container class verbatim").
- No 5th typography size or 3rd weight introduced anywhere else.

### Pillar 5: Spacing (3/4)
- The dominant spacing pattern across all 5 leaves is the declared scale: `px-3`/`py-2` (17 occurrences each), `mt-3` (9), `gap-2`/`gap-3`, `p-3` — solidly on-scale.
- The declared exceptions are correctly reused verbatim: `ScopeChip.tsx:28` (`px-2.5 py-1 gap-1.5`, matching `ActiveExpertChip`'s container) and `ExpertFilterPills.tsx:23` (`px-2.5 py-1`, matching the shipped ribbon pill).
- **New violations of §2's explicit ban** ("No new element introduces a 2px, 6px, 10px or 14px value of its own"), all introducing a fresh 6px (`-1.5`) value not covered by any exception:
  - `ScopePicker.tsx:71` — `ACTION = "... px-3 py-1.5 ..."` (Cancel / Apply / Try again buttons)
  - `ExpertSpendCard.tsx:86` — `ModeTag`: `"ml-1.5 text-[11px] px-1.5 py-px rounded ..."`
  - `ExpertSpendCard.tsx:197` — the unrated chip: `"ml-1.5 text-amber-700 ... px-2 text-[11px]"`
  - `ExpertSpendCard.tsx:311` — `SubagentTag`: `"text-[11px] px-1.5 rounded ..."`
  - `AttributionDisclosures.tsx:28,39` — both Blind Spots tile bodies: `"text-[11px] text-muted-foreground mt-1.5 leading-relaxed"`
  - None of these sites are `gap-1.5` on a chip container (the one documented exception) — they are new `px`/`py`/`ml`/`mt` uses of the same forbidden 6px unit, on 3 different files.
- No arbitrary bracket spacing values (`p-[...]`, `m-[...]`, `gap-[...]`) were found — the violation is entirely within Tailwind's own 1.5-step scale, which is easy to miss in review since it looks native to Tailwind even though the spec bans it for this phase.

### Pillar 6: Experience Design (3/4)
- **State coverage is thorough and correctly implemented**, verified in both code and live Chrome UAT (operator-approved 2026-09-29):
  - Loading: picker P1 (`Loader2` + "Checking what your next message will search…", `role="status"`), Spend-by-Expert card `Loading…` row.
  - Error: picker P4 (`role="alert"`, destructive box, `Try again` retry), the refusal box (`role="alert"`, `data-testid="scope-refusal"`), the recon footer's rose/`XCircle` failure state.
  - Empty: `No Expert` row always present at `$0.0000` even at zero runs (confirmed live, `g4-1-light-spend-fa.png` shows `No Expert $3.4553` populated); `Nothing changes` muted literal for an empty `Stops searching` column.
  - Disabled/aria-busy: Apply is `disabled={!canApply}` and shows `aria-busy` while in flight; the chip shows `Loader2` + `aria-busy` during S3.
  - Keyboard: correctly avoids the `AttentionPopover` Tab-trap pitfall by making Cancel/Apply/Try-again real `DropdownMenuItem`s rather than plain buttons (`ScopePicker.tsx:230-238,271-286`), as UI-SPEC §8.4 requires.
  - Mobile: `min-h-[44px] sm:min-h-0` correctly applied to tree nodes, action buttons, and filter pills.
  - Reduced motion: `motion-reduce:animate-none` on every `Loader2` spinner.
- **Real gap, found and disclosed by the phase itself, not fully closed:** the phase's own live cross-provider board (SC#10, `268-UAT-LOG.md`) found that before the D-268-26 fix, 6 of 8 providers answered a same-prompt follow-up from stale history and cited a document in the just-dropped folder — directly contradicting the picker's own promise, "Applies from your next message. Earlier answers keep their sources." After the fix, 6/8 pass and 2/8 (openai, google) remain unmeasurable under the fixed pass bar because their exploration tools (`grep`/`read_document`) leave no audit trail the bar can score. This means the feature's core promise — "the scope you see in the UI is what the next answer actually used" — is not uniformly true across the product's provider roster, even though the UI itself states the promise correctly and consistently. This is a real, adversarially-relevant finding: a UI that states a guarantee the backend cannot yet keep on 2/8 providers is not fully honest at the system level, even though every UI element within this phase's control (the chip, the picker, the card, the note) does exactly what it claims.
- O-1 (Pillar 2) also degrades Experience Design: a picker whose stated effect cannot be fully read undermines the "consequence stated before the click" interaction contract in §6.1.
- SC#1-continued (a paused-then-resumed run's spend attribution) is recorded `OWED-manual` — not disproven, but not live-verified either, leaving one live-proof gap in the spend-accuracy claim for the Continue case specifically.

---

## Registry Safety

`components.json` present (shadcn initialized). UI-SPEC §10 declares no third-party registries for this phase — only the shipped `dropdown-menu` and `button` shadcn-official blocks are reused, with no new component installs. Registry audit: 0 third-party blocks checked, no flags.

---

## Files Audited

- `frontend/src/components/chat/ScopeChip.tsx`
- `frontend/src/components/chat/ScopePicker.tsx`
- `frontend/src/components/chat/scopeCopy.ts`
- `frontend/src/components/experts/ScopeLedger.tsx`
- `frontend/src/components/chat/ExpertEventCard.tsx` (`ScopeChangedCard` branch)
- `frontend/src/components/admin/spend/ExpertFilterPills.tsx`
- `frontend/src/components/admin/spend/ExpertSpendCard.tsx`
- `frontend/src/components/admin/spend/AttributionDisclosures.tsx`
- `frontend/src/components/admin/spend/expertSpendCopy.ts`
- `.planning/phases/268-expert-spend-mid-thread-scope/268-UI-SPEC.md`
- `.planning/phases/268-expert-spend-mid-thread-scope/268-CONTEXT.md`
- `.planning/phases/268-expert-spend-mid-thread-scope/268-UAT-LOG.md`
- `.planning/phases/268-expert-spend-mid-thread-scope/268-01-SUMMARY.md` through `268-04-SUMMARY.md`
- `.planning/sketches/268-expert-spend-and-mid-thread-scope/README.md`
- Live evidence: `evidence/g4-1-light-spend-fa.png`, `g4-1-dark-spend-fa.png`, `g4-2-light-after-apply.png`, `g4-2-light-followup.png`, `g4-2-dark-card.png`, `g4-3-light-picker.png`, `g4-3-light-card.png`, `g4-3-light-followup.png`, `g4-3-dark-card.png`
