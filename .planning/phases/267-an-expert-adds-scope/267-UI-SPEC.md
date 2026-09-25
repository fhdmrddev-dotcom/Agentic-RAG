---
phase: 267
slug: an-expert-adds-scope
status: approved
shadcn_initialized: true
preset: "components.json — style default, baseColor slate, cssVariables, iconLibrary lucide (no preset string; theme = Aether Deep Midnight in src/index.css)"
created: 2026-09-25
acceptance_bar: ".planning/sketches/267-an-expert-adds-scope/index.html — Variant B 'Will / won't ledger' (operator, 2026-09-25, D-267-27)"
---

# Phase 267: UI Design Contract (An Expert Adds Scope)

> This is the visual and interaction contract for PACK-21..25. The gsd-ui-researcher wrote it and gsd-ui-checker verifies it.
> **Acceptance bar:** sketch 267 **Variant B** (D-267-27). Its layout and labels are LOCKED: `Brings` / `Missing`,
> `Will use` / `Won't use · N`, the timestamped `Now` / `Dropped` event card, `Replace <active>` /
> `New chat with <Expert> →`, and `Here` / `Open →`. This contract makes them concrete. It re-decides none of them.
> Every departure from the sketch's pixels is listed in §9 with its reason.

**Scope rule for this contract:** it adds no new surface. Every state below either extends a shipped component
(`InviteExpertDialog`, `ExpertCard`, `ExpertDetailModal`, `MessageItem`, `expertCatalog.ts`) or adds a leaf
renderer that one of those files mounts. There are **zero new top-level composer controls** and no new nav entry.

---

## 1. Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (already initialised: `frontend/components.json`) |
| Preset | not applicable. The theme is the Aether Deep Midnight `.dark` block in `frontend/src/index.css` |
| Component library | Radix, through the shipped shadcn `Dialog` (`@/components/ui/dialog`). No new primitive |
| Icon library | lucide-react (`components.json` → `iconLibrary: lucide`) |
| Font | Inter (body, `font-sans`), Manrope (`font-headline`, not used by this phase), JetBrains Mono (`font-mono`: timestamps, file names in the event sub-line, the dialog's folder path) |
| New dependencies | **none** |
| Design-findings skill | `sketch-findings-agentic-rag`, treated as locked. It contributes: never colour alone, honest absence, one home per concern, calm-until-it-has-something-to-say |

---

## 2. Spacing Scale

These are the declared values. Every value is a multiple of 4, and new elements use only these.

| Token | Value | Tailwind | Usage in this phase |
|-------|-------|----------|---------------------|
| xs | 4px | `gap-1`, `space-y-1`, `mt-1` | Ledger list item rhythm, icon-to-text gap inside event/ledger lines |
| sm | 8px | `gap-2`, `py-2`, `mt-2` | Ledger column gap, ledger cell vertical padding, gap between the action line and the buttons |
| md | 12px | `p-3`, `px-3`, `mt-3` | Ledger cell horizontal padding, event card padding, handoff card padding, row actions top margin (shipped `mt-3`) |
| lg | 16px | `gap-4`, `p-4` | Transcript vertical rhythm between an event card and its neighbouring messages (the `MessageList` gap already in use) |
| xl | 24px | `p-6` | Dialog padding (shipped, unchanged) |
| 2xl | 48px | none | Not used by new elements |
| 3xl | 64px | none | Not used by new elements |

**Exceptions:** these shipped values stay **byte-unchanged** and are not new declarations.
- `InviteExpertDialog` row padding `p-3.5` (14px) and `gap-1.5` (6px).
- `ExpertCard` pill padding `px-2 py-0.5`.
- The shipped button padding `px-3 py-1.5` (12px / 6px).

New buttons copy the shipped button class verbatim so they match their neighbours. A new element never introduces
a 2px, 6px, 10px or 14px value.

Touch target: every new interactive element (`Connect HubSpot →`, `Replace …`, `New chat with … →`, `Open …→`,
`Try again`) keeps the shipped button height of about 28px on desktop. At `< 640px` it gets `min-h-[44px]` through the
dialog's existing mobile full-width layout (see §8.6).

---

## 3. Typography

New elements declare exactly **4 sizes** and **2 weights**.

| Role | Size | Tailwind | Weight | Line height | Used for |
|------|------|----------|--------|-------------|----------|
| Label | 11px | `text-[11px]` | 600 (`font-semibold`), `uppercase tracking-wider` | 1.4 (`leading-snug`) | Ledger headings (`BRINGS`, `MISSING`, `WILL USE`, `WON'T USE · 4`), event keys (`NOW`, `DROPPED`, `HERE`, `OPEN`) |
| Meta | 11px | `text-[11px]` | 400 | 1.4 | Event timestamps (`font-mono`), the file-name sub-line (`font-mono`), the "is active here" line, the "Checking…" line |
| Body | 12px | `text-xs` | 400 | 1.5 (`leading-relaxed`) | Ledger items, event values, gate lines, handoff summary bullets, refusal/error text, button labels |
| Body-strong | 12px | `text-xs` | 600 | 1.5 | Event card header (`✦ Financial Analyzer → HR Advisor`), handoff card header (`↪ Handed off from "…"`) |
| Row title | 14px | `text-sm` | 600 | 1.4 | The Expert's name in dialog rows (shipped, unchanged) |
| Dialog title | 16px | `text-base` | 600 | 1.4 | "Invite an Expert" (shipped, unchanged) |

Declared sizes are **11 / 12 / 14 / 16**, and only 11 and 12 are introduced by this phase. Declared weights are
**400 / 600**.

**Exception, inherited and not new:** the shipped buttons carry `font-medium` (500). A new button that sits beside a
shipped one copies that class verbatim, so the row reads as one control set. No new non-button element uses 500.

**Deviation from sketch:** the sketch draws ledger headings at 10px. This contract sets them at **11px**, which keeps
the declared set at 4 sizes and holds legibility for uppercase labels (§9-D1).

---

## 4. Color

All values are the shipped `.dark` tokens (`frontend/src/index.css`). **No new CSS variable is introduced.**

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--background` `hsl(216 45% 4%)` | Chat transcript canvas, which the event and handoff cards sit on |
| Secondary (30%) | `--card` `hsl(220 30% 7%)`, `--muted` `hsl(220 30% 11%)` | Dialog surface (`bg-card/95`), dialog rows (`bg-muted/30`), handoff card body (`bg-card`), removal event card (`bg-card`) |
| Accent (10%) | Expert violet: `--accent-violet` `hsl(258 90% 66%)` via `violet-500/*`, text via `violet-200/300` | Expert identity only (see the reserved list) |
| Primary | `--primary` `hsl(239 100% 82%)` | The ONE primary CTA per row, the handoff card's left bar and header, and the `Open …→` link |
| Semantic "will" | `emerald-500/[0.08]` bg, `emerald-500/25` border, `emerald-300` text | `Brings` / `Will use` column surface. `Now` values in the event card |
| Semantic "won't" | `rose-500/10` bg, `rose-500/25` border, `rose-300` text | `Missing` / `Won't use · N` column surface. `Dropped` values in the event card. Matches the shipped `Restricted` pill family |
| Destructive | `--destructive` `hsl(0 72% 51%)` | **Error alerts only**: preview failure, handoff refusal. They reuse the dialog's shipped `bg-destructive/10 border-destructive/30 text-destructive` box. There is no destructive *action* in this phase |

**Violet accent is reserved for exactly these elements:**
1. The join / swap event card's border (`border-violet-500/35`), its wash (`bg-violet-500/[0.06]`) and its header text (`text-violet-200`).
2. The `Sparkles` (✦) glyph in the event header.
3. The shipped `ActiveExpertChip`, the dialog header gem and the active dialog row. These are unchanged.
4. The handoff *event* header in the original thread (`ArrowUpRight`, `text-violet-200`).

Violet is **never** used for buttons, links, ledger columns or error states.

**Never colour alone (WCAG 1.4.1):** every coloured column or line also carries its word. Those words are the ledger
headings, the `Now`/`Dropped`/`Here`/`Open` keys, and the `Replace`/`New chat with` verbs. The removal event is
distinguished by its header words (`HR Advisor left`), not only by its neutral border.

Contrast: `emerald-300` (#6ee7b7) and `rose-300` (#fda4af) at 12px on `--card` are both above 4.5:1. Muted text uses the
shipped `text-muted-foreground` (`hsl(220 16% 65%)`, about 7.7:1).

---

## 5. Surface contracts

### 5.1 The gate: `expertCatalog.ts` stays the ONE home of gate wording (PACK-22, D-267-06)

- `inviteGate(expert)` and `installView(expert)` are **extended**, not forked. Gate order is **install → connection**.
  The first blocking fact wins, and a surface never shows two gate reasons at once.
- New copy lives in a `CONNECTION_COPY` const beside `INSTALL_COPY`, pinned by `expertCatalog.test.ts`, with the same
  discipline: no literal is spelled in a component.
- The server overlay returns `required_connections` as `{slug, name, connected}[]` (D-267-05).
  **Recommendation (266 `can_install` precedent):** the overlay also returns `can_connect: boolean`, true iff the
  caller holds **`org:manage`** AND `live_connectors` is visible. That is the permission `POST /connections` enforces
  (`api/connectors.py:476-485`).
  - ⛔ It must NOT be `experts:manage`. That is a distinct permission (`api/experts.py:150`), so an experts-manager who
    is not an org manager would get a `Connect` button that 403s. That is the "button that does nothing" this
    contract forbids.
- A new selector, `connectionGate(expert)`, returns
  `null | { missing: {slug,name}[], brings: string[], line: string, action: {label} | null, ask: string | null }`.
  - Exactly one of `action` / `ask` is non-null.
  - `brings` is derived from the SAME overlay payload as `missing`: one payload, two lists (D-267-27 ⛔).

### 5.2 `InviteExpertDialog.tsx`: row states

The dialog widens from `max-w-md` to **`max-w-lg`** (512px). The second-Expert button pair ("Replace Financial
Analyzer" + "New chat with Contract Reviewer →") needs about 410px and wraps badly at 448px.

**Description line (replaces the shipped sentence):** the shipped `DialogDescription` says *"The expert scopes
document search and tools…"*. That is **false after D-267-01**, because an Expert no longer narrows tools, so it is
removed. The replacement is the sketch's context line:

| Thread state | `DialogDescription` |
|---|---|
| Thread has `folder_id` | `This chat · ` + `<span class="font-mono">/{folder name}</span>` |
| No folder (or no thread yet) | `This chat · All your documents` |

**Row state matrix.** Evaluate top to bottom. The first match renders the row's **action area**. The header (gem,
name, scope pill), description and meta line are shipped and unchanged unless a cell says otherwise.

| # | Condition | Ledger (at rest, below meta) | Action area |
|---|---|---|---|
| R1 | Row is the active Expert | If restricted: the `Will use` / `Won't use · N` ledger from the preview (§5.3). Otherwise none | Shipped `✓ Active` pill, unchanged |
| R2 | `inviteGate` install reason (266) | none | Shipped 266 italic reason line, unchanged |
| R3 | `connectionGate` non-null | `Brings` / `Missing` ledger. It **replaces the meta line** (one statement, not two) | Line `Requires HubSpot — not connected` (12px, `text-rose-300`, left). **Admin:** `Connect HubSpot →` (ghost button, right). **Member:** second line `Ask an org admin to connect HubSpot.` (12px muted), and no button |
| R4 | Restricted, preview loading | Placeholder cell: `Loader2` 12px + `Checking what HR Advisor will read…` (11px muted) | **No invite control yet.** The cost must be stated before it can be accepted |
| R5 | Restricted, preview failed | none | `role="alert"` box: `Couldn't check which documents HR Advisor will skip.` + ghost `Try again` (re-fetches this row's preview only) |
| R6 | No Expert active | Restricted: `Will use` / `Won't use · N`. Biased: none | Shipped `✦ Invite to Thread` primary button, unchanged |
| R7 | Another Expert active, thread has ≥ 1 message | as R6 | Line `Financial Analyzer is active here.` (11px muted, full width, left), then a wrapping, right-aligned button pair: ghost `Replace Financial Analyzer` and primary `New chat with Contract Reviewer →` |
| R8 | Another Expert active, thread has 0 messages (or no thread yet) | as R6 | Line `Financial Analyzer is active here.`, then primary `Replace Financial Analyzer` **only**. There is nothing to hand off, and replacing is lossless on an empty thread (recommendation, §9-D4) |
| R9 | Handoff in flight for THIS row | unchanged | `New chat with …` becomes `Loader2` + `Summarising this chat…` and is disabled. **Every other row's actions** get `aria-disabled` and ignore clicks. The dialog ignores `onOpenChange(false)` while in flight (§6.3) |
| R10 | Handoff refused for THIS row | unchanged | `role="alert"` box under the buttons: `Couldn't start a new chat with Contract Reviewer. {reason} Nothing was created.` The buttons re-enable, so clicking again is the retry |

**Restricted + missing connection:** R3 wins. The preview is **not fetched** for a row that cannot be invited.

**Restricted + zero Expert folders (the 266 CR-01 state; the run would be refused):** recommend `connectionGate`'s
sibling gate returns the line `HR Advisor has no knowledge folders yet, so it cannot answer from documents.` in the
action area, and no invite control. The planner decides whether this lands in 267 or is recorded (§9-D5).

**Ledger component, one for all three surfaces:** `ScopeLedger` (new leaf, `components/experts/ScopeLedger.tsx`).
- It takes `columns: {tone: "yes" | "no", heading: string, items: LedgerItem[], more?: number}[]`, built from one
  payload by a pure selector.
- Layout: `grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3`. A single-column ledger (only `Will use`) spans full width.
- Cell: `rounded-lg border px-3 py-2`. `yes` = `border-emerald-500/25 bg-emerald-500/[0.08]`. `no` = `border-rose-500/25 bg-rose-500/10`.
- Heading: `<p id>` 11px/600 uppercase `text-muted-foreground`. The list is a `<ul aria-labelledby>` with `space-y-1`
  and 12px `text-foreground` items. Each item is `truncate` with its full text in `title`. The full text is also the
  accessible name, so truncation never hides the only copy.
- More than 5 items: the first 5 render, then a muted item `and {k} more`.
- An unresolvable folder renders the shipped `UNNAMEABLE_FOLDER` phrase (`a knowledge folder you cannot see`) with
  `EyeOff`, never a blank.

### 5.3 Restricted-cost preview (PACK-25, D-267-17..19)

- **Fetched for:** every restricted row in the open dialog that is not blocked by R2/R3, *including the active
  restricted row* (R1). One request per row, in parallel, when the dialog opens. It is not cached across openings,
  because the thread's folder contents can change.
- **Payload → ledger:**
  - `Will use` = the Expert's folder names (server-named), then the literal `Chat attachments` last (D-267-19).
  - `Won't use · {excluded_count}` = up to 5 file names + `and {k} more`.
- **`Won't use` column renders only when `excluded_count > 0`.** When the thread has no folder, or nothing is
  excluded, the ledger is `Will use` alone. That is the D-267-18 "states only what it reads" case, and it must not
  show a `Won't use · 0` box.
- The heading `Won't use · 4` uses the middle dot `·` (U+00B7) with single spaces, exactly as in the sketch.
- ⛔ The count in the heading and the names in the list come from the **same response object**. The heading is never
  computed from `items.length`.

### 5.4 `ExpertCard.tsx` (catalog card face)

- **Missing connection (R3 equivalent):**
  - The scope-pill envelope is **replaced** by the `Brings` / `Missing` `ScopeLedger`.
    - `Brings` = the envelope's own tokens: `N folder(s)` (count, per the card's own "names are the modal's job"
      rule), skill names, and connected connection names.
    - `Missing` = the missing connection names.
  - Directly under the ledger comes one line: `Requires HubSpot — not connected` (12px `text-rose-300`). This is the
    PACK-22 / SC#2 literal, visible on the card at rest.
  - Footer: `Details` (unchanged) + **admin** `Connect HubSpot →` (the shipped primary button class, `Plug` icon) or
    **member** `StatusPill` `An org admin must connect HubSpot`.
    - ⚠ The shipped `StatusPill` puts its reason in `title` (hover-only). That is acceptable **only because** the
      visible line above already carries the reason at rest. Do not rely on the `title`.
- **Start Chat in flight (SEED-309 R265-262-04, folded by D-267-24):** `Start Chat` becomes `Loader2` + `Starting…`
  and is disabled until `startScopedChat` resolves or rejects. On reject the button re-enables and the shipped error
  path runs. A second click during flight is a no-op, and a test pins it.
- **Restricted Experts on the card:** no change. A catalog Start Chat opens a **new** thread with no folder, so
  nothing is excluded. The shipped `Restricted` pill plus the modal's `Bound Folders` is the statement (D-267-18,
  second bullet).

### 5.5 `ExpertDetailModal.tsx`

- **Required Connections section:** each `NamePill` shows its state.
  - Connected: `Plug` + name, shipped style.
  - Missing: `border-rose-500/25 bg-rose-500/10 text-rose-300`, `Plug` + `HubSpot · not connected`.
  - The shipped `HONEST.noConnections` line is unchanged.
- **Footer, missing-connection state:** `Close` + (**admin**) a `FooterLine` `Requires HubSpot — not connected` + the
  primary button `Connect HubSpot →`, or (**member**) a `FooterLine`
  `Requires HubSpot — not connected. Ask an org admin to connect HubSpot.`
  - `Start Scoped Chat with Expert` is **not rendered** in this state. There is no disabled variant.
- **Start Scoped Chat in flight:** the same `Starting…` contract as §5.4.

### 5.6 Transcript event card (PACK-23, D-267-09..12)

The new leaf is `components/chat/ExpertEventCard.tsx`. It is mounted from `MessageItem.tsx` by **one kind check**
(`role === "system"` and `tool_calls[0].kind` in the transcript-only allowlist), the same shape as the notice
siblings at `:639` / `:657`. There is no new branch on Expert state inside any shared renderer.

**Anatomy (sketch B `.evcard`):**

```
┌──────────────────────────────────────────────────────────────┐
│ ✦ Financial Analyzer → HR Advisor                      14:32 │  header: 12px/600, time 11px mono muted, ml-auto
│ NOW      HR Policies                                          │  key 11px/600 uppercase muted · value 12px emerald-300
│ DROPPED  Financial Reports & Filings · /Client ACME (4)       │  value 12px rose-300
│          ACME_MSA_2026.pdf · ACME_SOW_03.docx · …             │  11px mono muted sub-line (restricted exclusions only)
└──────────────────────────────────────────────────────────────┘
```

- Container: `w-full rounded-[10px] border px-3 py-3 text-xs`. The lines are `grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 mt-2`.
  - `rounded-[10px]` is the app's `--radius-md` (shipped radius family, not a spacing value).
- **Variants.** The shape is identical in every variant; only the header and tone change.

| Event | Header | Tone | `Now` | `Dropped` |
|---|---|---|---|---|
| Join (on a thread with ≥ 1 message) | `✦ HR Advisor joined` | violet (`border-violet-500/35 bg-violet-500/[0.06]`, header `text-violet-200`) | the next turn's knowledge set | what the previous turn used and the next will not, or `Nothing` |
| Swap | `✦ Financial Analyzer → HR Advisor` | violet | as above | as above |
| Removal | `HR Advisor left` (no glyph) | neutral (`border-border bg-card`, header `text-foreground`) | as above | as above |

- **Value vocabulary.** One home: `components/chat/expertEventCopy.ts`, pinned by a `?raw`-free unit test.
  - Expert folders are listed by name.
  - The thread's folder is `/{name} ({doc count})`.
  - A plain thread with no folder is `All your documents`.
  - Connections added or dropped are the connection name with a 12px `Plug` icon.
  - Items are joined by ` · `.
  - An unnamed folder is `a knowledge folder you cannot see`.
  - An empty `Dropped` renders the literal `Nothing` in muted text, not rose. The two-line shape is constant, so the
    card never looks like it lost a row.
- **Restricted exclusion sub-line:** when the new Expert is restricted and excluded any documents, a sub-line sits
  under the `Dropped` value. It holds up to 5 file names (11px mono muted, ` · `-joined, `and {k} more`), then
  ` · Chat attachments stay readable.`
  - This is the D-267-18 "the event repeats it" obligation.
  - It renders from the **event payload**, which snapshots the same preview structure at write time. It is never
    re-fetched.
- **Timestamp:** `<time dateTime={iso}>`. Show `HH:mm` (locale, 2-digit) on the same day; otherwise `MMM d, HH:mm`.
- **Snapshot rule:** names in the card are the names **at the moment of the change**, read from the payload. Renaming
  or deleting an Expert or folder later does not rewrite history.
- **When it appears:** immediately after the `PATCH` resolves, without a reload. Append the returned row, or refetch
  the snapshot; Realtime is a hint. It must still be there after reload (G-4 #2).
- **Not written on an empty thread** (D-267-12). The shipped spotlight card stays the announcement there.
- **Transient mid-thread spotlight:** `ChatArea.tsx` also renders `ExpertSpotlightCard` below the list when
  `expertInvited`. It **stays**, because it is the PACK-03 prompt-tile door, not an announcement. The event card is
  the persisted record (recommendation, §9-D6).
- **Motion:** live append only, `animate-in fade-in duration-200 motion-reduce:animate-none`. No animation on reload.
- **A11y:** `role="note"` with `aria-label="Expert change at 14:32"`. Keys are visible text, never `aria-hidden`.

### 5.7 Handoff: original thread event (PACK-24, D-267-16)

The same `ExpertEventCard` handles a second allowlisted kind. **Recommended discriminator:** `expert_handoff`. The
planner picks the name, but it must live in the same one-home allowlist constant as `expert_changed`.

```
┌──────────────────────────────────────────────────────────────┐
│ ↗ Contract Reviewer · new chat                         14:45 │  ArrowUpRight 12px, header text-violet-200
│ HERE     Financial Analyzer stays                             │  12px text-foreground
│ OPEN     Contract Reviewer · ACME →                           │  12px text-primary link (button), font-semibold
└──────────────────────────────────────────────────────────────┘
```

- `Open` value: a `<button type="button">` styled as a link. It calls `selectThread(thread)` with the thread object
  from the loaded list, because the app has no router.
- **Target thread no longer in the list** (deleted): render `{title} · deleted` as muted text with **no** link. A
  link to nothing is a control that does nothing.

### 5.8 Handoff card: new thread's first message (PACK-24, D-267-15)

The new leaf is `components/chat/HandoffCard.tsx`. `MessageItem` renders it **instead of** the user bubble when the
row carries the handoff marker, using one marker check.

```
┃ ↪ Handed off from “Q3 board prep”                             header: CornerDownRight 12px + 12px/600 text-primary
┃  • ACME Q3 invoices: $412K (+9% on Q2)                        ul list-disc pl-4, 12px text-muted-foreground, space-y-1
┃  • Two invoices overdue > 30 days
┃  • Open: does the MSA late-payment clause apply?
```

- Container: `w-full rounded-[10px] border border-border border-l-[3px] border-l-primary bg-card p-3`.
- The source title is plain text, snapshotted in the marker, not a link (as in the sketch).
- The title uses curly quotes `“ ”`, truncated at 60 characters with `…`.
- **Summary shape (recommendation):** the service returns `string[]` of 3-6 items, each at most 160 characters. The
  card renders bullets. If a legacy or degraded payload is a single string, it renders as one `<p>` (12px
  `text-foreground`). There is never an empty card: D-267-16 refuses the handoff before a thread is created.
- The composer's shipped `Using:` chip shows the new Expert. There is no other new chrome.
- **New thread title (recommendation):** `{Expert name} · {source title}`, truncated at 60 characters and set
  server-side in the same request. No second LLM call.

---

## 6. Interaction contracts

### 6.1 Connect (PACK-22, D-267-06/08)
- `Connect HubSpot →` (one missing) or `Open Connections →` (two or more missing) closes the dialog or modal, then
  navigates to the Connections page through the shipped `onNavigate("connections")` door (`ChatLayout.tsx:838`).
  There is no per-service deep link (D-267-08, deferred).
- Rendered only when `can_connect === true`. Otherwise the member sentence renders, with no button.

### 6.2 Invite / Replace / Remove (PACK-23)
- `Invite to Thread` and `Replace …` keep the shipped behaviour: `onSelectExpert(expert)` and close. The consequence
  was stated **before** the click (the row's ledger) and is recorded **as it happens** (the event card).
- Remove stays the shipped `✕` on `ActiveExpertChip`, and the event card is its receipt.
- **No confirmation dialog** for any of the three. Each is reversible by re-inviting, and its cost is on screen
  before or as it happens. A confirm step would be friction without information.

### 6.3 New chat with … (PACK-24, D-267-13/14/16)
1. The user clicks `New chat with Contract Reviewer →` and the row enters R9. The dialog cannot be dismissed (Esc,
   overlay click and ✕ are ignored) while it is in flight. This prevents an orphaned navigation after the user has
   moved on.
2. The client sends one `POST /threads/{id}/handoff {expert_id}`. It is the only request, so a double click cannot
   create two threads (the in-flight guard plus the single-request design).
3. **Success:** close the dialog, refresh the thread list, **then** `selectThread(newThread)`. This is the
   `startScopedChat` order, "refresh BEFORE select". The original thread now holds the §5.7 event.
4. **Refusal or failure:** R10. Nothing navigates. `{reason}` is:
   - Summary failed: `This chat could not be summarised.`
   - Gate refusals (entitlement, access, install, connection): the server's `detail` sentence verbatim, as React text
     only.
   - Network: `The server could not be reached.`
   - The sentence always ends `Nothing was created.` That is the D-267-16 guarantee made visible.

### 6.4 Restricted preview retry
- `Try again` re-requests only that row's preview and returns the row to R4.

### 6.5 Studio toggle removal (D-267-02)
- `ExpertAuthoringStudio.tsx`: remove the `Preserve Deliverable Tool Floor (Recommended)` checkbox block and the
  preview's `Additive Tool Floor:` indicator. After D-267-01 both describe a switch that no longer does anything.
- No replacement copy. The `tool_floor_enabled` field may still be sent unchanged, as the planner decides.

---

## 7. Copywriting Contract

All strings are exact. The em dash is `—` (U+2014), the middle dot is `·` (U+00B7), and the arrows `→` (U+2192) and
`↗` / `↪` are rendered as lucide icons where noted. Homes: gate words go in `expertCatalog.ts`
(`CONNECTION_COPY`), event and handoff words in `components/chat/expertEventCopy.ts`, and ledger headings in the
same module as the selector that builds the payload.

### 7.1 Primary CTAs

| Element | Copy |
|---|---|
| Primary CTA (no Expert active) | `Invite to Thread` (shipped) |
| Primary CTA (second Expert) | `New chat with {Expert} →` |
| Secondary (second Expert) | `Replace {active Expert}` |
| Admin connect (one missing) | `Connect {Service} →` |
| Admin connect (two or more missing) | `Open Connections →` |
| Retry preview | `Try again` |
| Catalog Start Chat in flight | `Starting…` |
| Handoff in flight | `Summarising this chat…` |

### 7.2 Gate and ledger (PACK-22 / PACK-25)

| Element | Copy |
|---|---|
| Gate line, 1 missing | `Requires HubSpot — not connected` |
| Gate line, 2 missing | `Requires HubSpot and Salesforce — not connected` |
| Gate line, 3+ missing | `Requires HubSpot, Salesforce and Slack — not connected` |
| Member ask (dialog row) | `Ask an org admin to connect HubSpot.` (lists the same way as the gate line) |
| Member ask (modal footer) | `Requires HubSpot — not connected. Ask an org admin to connect HubSpot.` |
| Member ask (card pill) | `An org admin must connect HubSpot` (two or more: `An org admin must connect 2 services`) |
| Ledger headings | `Brings` · `Missing` · `Will use` · `Won't use · {N}` (displayed uppercase by CSS; the source string is title case) |
| Always-readable item | `Chat attachments` |
| Overflow item | `and {k} more` |
| Unnamed folder | `a knowledge folder you cannot see` (shipped `UNNAMEABLE_FOLDER`) |
| Modal missing pill | `{Service} · not connected` |
| Dialog context line | `This chat · /{folder}` or `This chat · All your documents` |
| Active line | `{active Expert} is active here.` |

### 7.3 Transcript (PACK-23 / PACK-24)

| Element | Copy |
|---|---|
| Join header | `{Expert} joined` |
| Swap header | `{from} → {to}` |
| Removal header | `{Expert} left` |
| Keys | `Now` · `Dropped` · `Here` · `Open` |
| Empty `Dropped` | `Nothing` |
| Plain thread scope | `All your documents` |
| Thread folder item | `/{folder} ({N})` |
| Exclusion sub-line tail | `Chat attachments stay readable.` |
| Handoff event header | `{Expert} · new chat` |
| Handoff `Here` value | `{active Expert} stays` |
| Handoff `Open` value | `{new thread title} →`. If deleted: `{title} · deleted` |
| Handoff card header | `Handed off from “{source title}”` |

### 7.4 Empty, loading and error states

| Element | Copy |
|---|---|
| Empty state heading (dialog, no Experts) | `No Experts available yet` |
| Empty state body (dialog, no Experts) | `An org admin can add one from the Experts catalog.` (replaces the shipped `No expert bundles currently available for this organization.`, which is jargon and names no next step) |
| Dialog list loading | `Loading Experts…` (shipped, with the case fixed) |
| Dialog list error | `Couldn't load Experts. {reason}` (shipped box; prefix added so a raw error never stands alone) |
| Preview loading | `Checking what {Expert} will read…` |
| Preview error | `Couldn't check which documents {Expert} will skip.` + `Try again` |
| Handoff refusal | `Couldn't start a new chat with {Expert}. {reason} Nothing was created.` |
| Summary-failed reason | `This chat could not be summarised.` |
| Network reason | `The server could not be reached.` |
| Restricted, no folders (recommended gate) | `{Expert} has no knowledge folders yet, so it cannot answer from documents.` |

### 7.5 Destructive actions

| Action | Confirmation |
|---|---|
| **None in this phase.** Replace, Remove and New chat are reversible. | No confirm dialog. The pre-click ledger (PACK-25) and the persisted event card (PACK-23) are the honesty mechanism (§6.2) |

**Removed copy (now false):**
- `The expert scopes document search and tools while retaining full chat history.` (dialog description)
- `Preserve Deliverable Tool Floor (Recommended)` and its paragraph (studio)
- `Additive Tool Floor: Delivers code execution, file writes, and template rendering.` (studio preview)

---

## 8. Accessibility and testability contract

1. **At rest, never hover-only (266 UI-3).** Tests assert the words are **visible**, using
   `toBeVisible()` / rendered text in the DOM with no hover, click or disclosure.
   - The words to check: every ledger heading and item, the gate line, the member ask, `Now` / `Dropped` values, and
     `Here` / `Open`.
   - A `title` attribute never counts as the visible copy.
2. **Content, not presence.** Assertions check the rendered strings, not `data-testid` presence alone (G-8 finding:
   "presence assertions cannot see content drift").
   - Test ids, for anchoring only: `scope-ledger`, `scope-ledger-col-yes`, `scope-ledger-col-no`,
     `connection-gate-line`, `connection-gate-connect`, `connection-gate-ask`, `scope-preview-loading`,
     `scope-preview-error`, `expert-replace-btn-{slug}`, `expert-handoff-btn-{slug}`, `handoff-refusal`,
     `expert-event-card`, `expert-event-now`, `expert-event-dropped`, `handoff-card`, `handoff-event-open`.
3. **Roles.**
   - Error boxes: `role="alert"`.
   - The preview loading line: `role="status"`.
   - Event card: `role="note"`.
   - Ledger lists: `<ul aria-labelledby={headingId}>`.
   - The in-flight button: `aria-busy="true"`.
   - Sibling rows during flight: `aria-disabled="true"`, with click handlers no-op'd. They are not removed from the
     tab order, so focus does not jump.
4. **Keyboard.** Every new control is a real `<button>`. `Open …→` is a button, not an `<a>` without an `href`.
   Focus stays inside the shipped Radix dialog.
5. **Mobile, below 640px.**
   - The ledger collapses to one column (`grid-cols-1`).
   - The button pair wraps full width (`flex-wrap`, each `w-full sm:w-auto`, `min-h-[44px] sm:min-h-0`).
   - Event and handoff cards are full column width.
   - Long Expert names inside buttons truncate at 20ch (`max-w-[20ch] truncate` on the name span). The full label
     goes in `aria-label`, and the full name stays visible in the row header.
6. **Reduced motion.** Event append animation: `motion-reduce:animate-none`.

---

## 9. Recorded deviations and recommendations (for the checker and planner)

| ID | What | Why |
|---|---|---|
| D1 | Ledger headings are 11px, not the sketch's 10px | Keeps the declared type set at 4 sizes. 10px uppercase is below comfortable legibility |
| D2 | The sketch's **disabled** `Invite to Thread` in the missing-connection row is **not rendered**. The action area shows the gate line plus Connect (admin) or the ask sentence (member) | "Members never see a button that does nothing" (constraint), and the 266 precedent in `installView`: "No arm is a disabled button: a state that cannot act renders a status LINE with the reason" (D-262-02). The ledger layout and labels are unchanged |
| D3 | `Requires HubSpot — not connected` appears as a line on all three surfaces **in addition to** the `Missing` column | PACK-22 / ROADMAP SC#2 quote this literal for the card **and** the invite. The sketch shows only the ledger. The line is the literal the verifier will look for |
| D4 | On a thread with zero messages, the second-Expert row offers only `Replace …` | A handoff summary of an empty thread is refused by definition. Offering the button would be a control that can only fail |
| D5 | Restricted Expert with zero folders: recommended gate line, no invite | 266 CR-01 refuses that run (`ExpertScopeUnavailable`). Saying so before the run is the PACK spirit. The planner decides 267 vs recorded |
| D6 | The transient mid-thread `ExpertSpotlightCard` (`expertInvited`) stays beside the new event card | It is the PACK-03 prompt-tile door. The event is the persisted record. If the operator reads it as a double announcement at G-4, removing the transient card is a one-condition change |
| D7 | The "is active here" line sits in the **action area** (above the buttons), not in the description slot | It is the context for the two buttons, so it sits next to the decision. The sketch's rows omit descriptions only because they are sample data, so the shipped description is kept |
| D8 | The event card adds a mono file-name sub-line under `Dropped` for a restricted exclusion | D-267-18: "the PACK-23 event repeats it". It renders from the event payload (one structure, D-267-27 ⛔) |
| D9 | Dialog width `max-w-md` → `max-w-lg` | The locked button labels do not fit at 448px without a 3-line wrap |
| R-1 | Overlay `can_connect` = `org:manage` ∧ `live_connectors` visible, **not** `experts:manage` | These are distinct permissions. The wrong one yields a Connect button that 403s |
| R-2 | Handoff summary = `string[]` (3-6 items, 160 characters each) | Matches sketch B's bullet shape. Planner discretion per CONTEXT |
| R-3 | Handoff thread title `{Expert} · {source title}`, set server-side | No second LLM call. Planner discretion |

**G-4 mapping (D-267-28):**
- **#1:** no new UI. It is a tool-floor proof, run on the live board.
- **#2 "the event card and `Won't use · 4` are still there after reload":**
  - The event card's `Dropped` line reads `/Client ACME (4)` with the four file names, which survives reload
    (it is a persisted row).
  - Reopening the invite dialog shows the **active** HR Advisor row (R1) with its `Won't use · 4` ledger at rest.
  - The verifier checks both.
- **#3:** the §5.8 handoff card plus the §5.7 original-thread event, with the original thread's
  `ActiveExpertChip` unchanged.

---

## 10. Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none new. Reuses the shipped `dialog` only | not required |
| Third-party | none | not applicable |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
