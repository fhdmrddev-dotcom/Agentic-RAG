---
id: BUG-260816-03
title: Thread-history rows cannot be told apart — one icon for every thread type, a repeated "Unfiled" chip, and a folder name that truncates the title to one word
reported: 2026-08-16
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [frontend/navigation, frontend/chat-list, frontend/layout, harness/workflow-ui]
folded_into: 244
verified_closed_by: null
related_seeds: [SEED-113, SEED-155]
re_open_trigger: "SUB-DEFECT (a) ONLY is still open — one hardcoded icon for every thread kind. (b) and (c) shipped in Phase 244 plan 01. Re-open on EITHER: (1) the next phase that adds a thread-kind / workflow discriminator to the GET /threads feed (today `Thread` in frontend/src/types/index.ts:7-14 carries none, so no row can branch), OR (2) the next chat-list sketch — the report itself routes (a) to /gsd:sketch and D-244-18 limited Phase 244 to ONE sketched surface (sketch 236, the composer). Consider sketching it together with SEED-155's library-card layout so the thread row and WorkflowCard do not invent two visual languages for 'this is a workflow'."
reproduces_on:
  branch: develop
  commit: 045a83dc
  date: 2026-08-16
---

# BUG-260816-03: Thread-history row identity — icon, folder chip and title truncation

Operator report during Phase 194 UAT (2026-08-16), verbatim:

> *"in thread history actually we have a lot of things that we need to work on … Now we are showing
> the icon of a folder that indicates that this thread is scoped to a folder but I see next to the
> other chats 'unfiled' which [is] confusing … the icon of the thread should be changed — if this is
> a regular chat it should be like as it is now, but if it is a workflow we should change this icon
> … also there is a lot of information … sometimes if it is showing a folder dot next to it it is
> showing just the first word … So we have to figure out a way that is simple, beautiful,
> professional and very user friendly."*

## What we observed

All three sub-defects live in **one render block**, `ChatHistoryColumn.tsx:169-194`.

### (a) One hardcoded icon for every thread type — a workflow run is indistinguishable from a chat

```tsx
<MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden="true" />
```

**Unconditional.** No branch on workflow vs Deep chat vs anything else.

Measured in the live DOM at `045a83dc`: **524 thread rows, every one carrying
`svg.lucide-message-square`** — zero variation. During this UAT session **eight consecutive rows all
read "Quarterly Business Review — Northwind Logistics"**, all workflow runs, all rendered exactly
like an ordinary chat and exactly like each other.

### (b) The "Unfiled" chip is repeated on nearly every row and carries no information

DATE mode renders a trailing chip: `FolderIcon + folder name` when scoped, or an **italic "Unfiled"**
(no icon) when not.

Measured: **471 of 524 rows read "Unfiled"** — 90 %. The word is on almost every row, it never
distinguishes anything, and next to the 53 rows that *do* carry a folder it reads as a second,
competing status rather than as "no folder".

### (c) ⚠ A folder name TRUNCATES THE THREAD TITLE — measured to 17 % of its natural width

This is the *"showing just the first word"* complaint, and the measurement is worse than the wording.

The chip is `shrink-0`; the title is `truncate flex-1 min-w-0`. **The chip therefore wins
unconditionally**, and a folder name is arbitrary, user-authored and unbounded.

Measured on live rows (`getBoundingClientRect().width` vs `scrollWidth`):

| Folder chip | Chip px | Title px rendered | Title px needed | **Title visible** |
|---|---|---|---|---|
| `Project Meridian — Risks` | 134 | **85** | 485 | **17.5 %** |
| `Project Meridian — Risks` | 134 | **85** | 556 | **15.3 %** |
| `Template-Test` | 83 | **136** | 553 | 24.6 % |
| `Template-Test` | 83 | **136** | 625 | 21.8 % |

**Every folder-scoped row sampled was truncated.** At 85 px a title renders roughly one word — so a
user scanning the rail sees the *folder's* name in full and the *thread's* name not at all. **The
row spends its scarcest resource on the least identifying field.**

## Why it matters

`major`. Chat is the app's default interface (`CLAUDE.md`, first line). The thread rail is how a user
re-finds work, and today it fails at exactly that:

- A workflow run and a chat look identical, so the rail cannot answer *"which of these was a run?"*
- Repeated titles + one icon means several runs of the same workflow are mutually indistinguishable.
- The one field that *would* disambiguate — the title — is the field being truncated away, and it is
  truncated **more** the more folder structure a user adopts. **Organising your work makes your work
  harder to find**, which is a perverse incentive rather than a cosmetic nit.

This is not the same as the already-closed `BUG-260711-01` (*chat list too narrow*, closed by 156).
That was about the **rail's width budget**. This is about **what the row spends its width on** — the
rail could be twice as wide and (a) and (b) would be unchanged, while (c) would only be deferred.

## Hypothesized cause

Hypothesis, not finding — but (c)'s mechanism is directly readable in the CSS above and was measured:
`shrink-0` on the meta chip against `truncate flex-1 min-w-0` on the title is a fixed priority
ordering that puts folder membership above thread identity. There is no `max-w-*` or truncation on
the chip itself.

For (a): the row was built before workflow threads existed as a distinct kind; nothing has since
given the row a notion of *thread type*. `Thread` would need a discriminator the row can read —
worth checking whether `active_workflow_run_id` / a workflow link is already available on the row's
data, or whether this needs a feed change.

For (b): "Unfiled" is a rendered *label* where it should probably be an *absence*. The design
question is whether unscoped should render nothing at all.

## Surface classification

`Agentic-RAG` — this app's own navigation frontend. Cross-checked at `/gsd:discuss-phase`,
`/gsd:new-milestone`, `/gsd:complete-milestone`.

## Suggested routing

- **Fold into in-flight phase:** n/a — Phase 194 is executed/verified; this is navigation IA, not the
  Stop path, and folding it in would be scope creep into a phase already at `gaps_found`.
- **Defer to future phase / milestone:** yes — its own phase.
- **Plant as seed:** yes if not scheduled soon — this is a cross-milestone IA concern.
- **External — note only:** no.

⚠ **G-2 FIRES, HARD, AND THIS ROUTES TO `/gsd:sketch` BEFORE ANY SPEC OR DISCUSS.** The operator's
own ask is explicitly a design ask — *"simple, beautiful, professional and very user friendly and UX
professional"* — and G-2 covers *"live UI, panel render, badge, label, visual"*. **An
operator-approved mockup is the acceptance bar here; there is no correct implementation to jump to.**
The real work is deciding what a thread row owes the reader:

- what identifies a **workflow run** row vs a **chat** row (icon? the shipped `PHASE_GLYPHS`? a
  different lead mark entirely?)
- whether *unscoped* renders **nothing** instead of the word "Unfiled"
- what wins when space is short — **title, always**; and what the folder degrades to (a dot? a
  tooltip? truncated chip with `max-w`? hidden below a width threshold?)
- whether run state (`running` / `stopped` / `failed`) belongs on the row at all — it connects to
  `BUG-260816-02`, where a stopped run leaves no trace anywhere

⚠ **There is already a deferred library-layout sketch owed (SEED-155) and `WorkflowCard.tsx` carries
an inherited G-5 refactor obligation.** If the thread-row sketch touches the same identity
vocabulary (how a workflow announces itself in a list), consider doing them in one sketch so the
library card and the thread row do not invent two different visual languages for the same idea.

---

## Partly shipped 2026-09-11 (Phase 244 plan 01 Task 3) — ⛔ STILL `folded`, (a) IS THE OPEN HALF

| Sub-defect | State |
|---|---|
| **(a)** one hardcoded icon for every thread kind | ⛔ **OPEN — deferred in writing, with the re-open trigger in this file's frontmatter** |
| **(b)** the repeated "Unfiled" chip | ✅ shipped — an unscoped row now renders **no chip at all** |
| **(c)** the folder chip truncating the title | ✅ shipped — the chip is capped at `max-w-[96px]` + `truncate`, with a `title=` keeping the full name reachable |

⭐ **C-7 — the report was PARTLY ALREADY BUILT, and the work was planned against the markup rather
than against this report.** At the phase's base the row already rendered a lead icon, a truncating
title with a full-title `title=` attribute and `HighlightTitle`, and a mode-switched meta chip.
**What was missing was a BOUND on the chip and the ABSENCE of the empty-state chip** — not the chip.

**(c)** The title span was **not** changed: `truncate flex-1 min-w-0` was already correct. The defect
was the chip's *unbounded* `shrink-0`, exactly as this report's own hypothesis says.
**(b)** Rides the shipped `empty ⇒ render nothing` rule (`ActiveConnectorChips.tsx:24`,
`AttentionPopover.tsx:75`, `PendingAskCard.tsx:733`) — an application of an established project
pattern, not a new design. ⛔ **`folderLabel` itself is UNTOUCHED**: `groupByFolder` still needs the
"Unfiled" GROUP LABEL in FOLDER mode, which is pinned by its own case.

⚠ **One shipped test PINNED the defect and was re-baselined deliberately** —
`ChatHistoryColumn.test.tsx`'s *"renders a folder chip (or 'Unfiled') per row"* asserted the 90 %
chip. The reason is written into the case rather than the assertion being quietly deleted.

⛔ **WHY (a) WAS NOT TAKEN — structural, not a difficulty judgement, and stated so it is not read as
"out of scope":**

1. `Thread` (`frontend/src/types/index.ts:7-14`) carries **no** kind/workflow discriminator, so no
   row can branch until `GET /threads` grows a field. That is a **feed change**, present in no source
   artifact for Phase 244.
2. This report's own instruction is *"G-2 FIRES, HARD, AND THIS ROUTES TO `/gsd:sketch` BEFORE ANY
   SPEC OR DISCUSS"* — and **D-244-18 rules that G-2 fires on exactly one surface in Phase 244**
   (sketch 236, the composer). Sketching a second surface would contradict a locked decision.

**Driven by:** `frontend/src/components/layout/__tests__/ChatHistoryColumn.rowIdentity.test.tsx`
(7 cases, 3 of them RED on the shipped tree). ⚠ jsdom does no layout, so the suite pins the class
contract that PRODUCES the bound; the pixel measurements in this report are re-driven as a G-4 row.

## Workarounds (prompt-side, code-side, or UI-side)

- Hover a row — the full title is in the `title` attribute (`<span title={thread.title}>`), so the
  native tooltip shows what the truncation hides.
- Use the **Folder** group mode toggle: in `folder` mode the trailing chip becomes the date bucket
  instead of the folder name, which is narrower and gives the title more room.
- Use the search box (`⌘K` / `library-search`) rather than scanning, since matching is on the full
  title, not the rendered one.

## Reference / evidence links

- `frontend/src/components/layout/ChatHistoryColumn.tsx:169-194` — the whole render block: the
  hardcoded `MessageSquare`, the `shrink-0` meta chip, the `truncate flex-1 min-w-0` title
- `frontend/src/lib/threadGroups.tsx` — `folderLabel` / `groupByFolder` / `bucketFor`
- `.planning/reported-bugs/chat-list-too-narrow-nav-panel-crowding.md` — `BUG-260711-01`, **closed**
  by 156; the width sibling of this bug, distinct from it
- `.planning/reported-bugs/BUG-260702-01-eval-runs-pollute-chat-sidebar-as-visible-threads.md` —
  adjacent: another "the rail shows rows that should not read like chats" problem
- `.planning/phases/194-stop-a-running-workflow/194-UAT.md` — the session these were observed in
- Live DOM measurement, 2026-08-16 at `045a83dc`: 524 rows, 524 `lucide-message-square`, 471
  "Unfiled", 53 folder-scoped, **all 53 sampled truncated**
