---
phase: 190-live-connector-slice-connector-security-stretch
plan: 17
subsystem: frontend-settings
tags: [react, settings, push-split-panel, focus-trap, focus-restore, conn-02, conn-03, d-23, d-26, d-27, sketch-156-a, wcag, write-only-secret, count-gate, wave-6, plant-driven]

# Dependency graph
requires:
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 16
    provides: "ConnectionsTab's onAdd/onOpen seam, the sibling *Copy.ts pattern, the D-190-DEF-07 branch-(b) resolution this plan finishes, and the measured `userEvent.setup({delay:null})` finding"
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 09
    provides: "the typed client functions + the three TS types, and the API-enforced org-admin + require_visible write gates this surface only MIRRORS"
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 06
    provides: "the write-only secret semantics — a present `secret` is a REPLACE that resets last_check_verdict to not_checked in the same UPDATE, and a response model that structurally cannot carry a credential"
provides:
  - "frontend/src/components/settings/ConnectionFormPanel.tsx — the 400px push/split shell with a REAL focus trap and focus restore, the per-capability field sets (4/5/3), the always-on 🔒 destination footer, the write-only secret and the org-shared line"
  - "frontend/src/components/settings/connectionFormCopy.ts — every panel string as an exported identifier plus the pure derivations, in a .ts sibling so the .tsx exports components only"
  - "the open/close seam in ConnectionsTab — Add opens create, a row name opens edit, a non-admin gets it READ-ONLY, and the list is never covered"
  - "THE OWED HALF OF D-190-DEF-07 — UI-SPEC §9's panel notice AND its footer corrected, plus the structural half (Save / Replace / inputs REMOVED while the switch is off). D-190-DEF-07 is now CLOSED in full"
  - "frontend/src/components/settings/__tests__/ConnectionFormPanel.test.tsx — 31 cases, TEN driven RED against real plants in production source"
  - "the suite registered on BOTH count-gate knobs in the commit that created it, with the pin proved to catch a deletion"
affects: [190-18, 190-19, 190-verify-phase, 190-secure-phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A SECOND sibling `*Copy.ts` beside the first — the panel's strings live in `connectionFormCopy.ts`, so `eslint src/components/settings/` stays at 5 rather than growing one error per exported string"
    - "A container-level key policy belongs on a NATIVE listener, not an `onKeyDown` JSX prop — measured, `jsx-a11y/no-noninteractive-element-interactions` takes eslint 5 → 6 on the prop form, and the rule is right that an `<aside>` is not becoming interactive"
    - "Assert a focus trap through `document.activeElement` WITH a control rendered outside the panel — without the outside node the test passes on a panel that merely has one focusable child"
    - "When a locked sketch string is false against the shipped response shape, substitute it and write the MEASUREMENT beside it (§3d's `stored 3 Aug` → `stored since {created}`) — the same discipline 190-16 applied to §2h"
    - "Check a plant for REACH, not merely for RED: name the failing test titles, because a plant can go red for a reason unrelated to the property it was meant to falsify"

key-files:
  created:
    - frontend/src/components/settings/ConnectionFormPanel.tsx
    - frontend/src/components/settings/connectionFormCopy.ts
    - frontend/src/components/settings/__tests__/ConnectionFormPanel.test.tsx
  modified:
    - frontend/src/components/settings/ConnectionsTab.tsx
    - scripts/vitest-count-gate.cjs
    - .planning/phases/190-live-connector-slice-connector-security-stretch/190-UI-SPEC.md
    - .planning/phases/190-live-connector-slice-connector-security-stretch/deferred-items.md

key-decisions:
  - "D-190-DEF-07's owed half PAID, same branch (b), not re-litigated — and the FOOTER 190-16 did not name (`will save · will not send`) carried the identical false promise one line below the notice, so it moved too"
  - "The panel's OFF-state and non-admin branches REMOVE Save / Replace / every input rather than disabling them — proved necessary by driving 190-16's plant-C shape here and confirming it reaches BOTH absence cases"
  - "Radix `Sheet` is NOT reused for the mobile half — it brings a second focus trap, and two traps competing for one subtree is how a keyboard user ends up unable to leave. One `<aside>`, one trap, one restore, both layouts"
  - "`tls` is DERIVED from the port (465 ⇒ implicit, else STARTTLS) rather than asked — §3b binds FOUR fields for send_email and a TLS radio would be a fifth. The choice is never silent: the 🔒 footer renders the resulting mode on every keystroke"
  - "The footer's `refused` tag claims ONLY what the browser can prove from the text (a plaintext scheme, a private/loopback literal) — the server refuses by RESOLVING, which a browser cannot do, so copy rule 5 forbids the stronger claim"
  - "§3d's `stored 3 Aug` is NOT shipped: `ConnectorConnection` carries no secret timestamp and `updated_at` moves on a rename, so dating a credential from it is the fabricated-timestamp error `credentialLabel` refuses one column away"

patterns-established:
  - "Author the copy module first, measure eslint, then write the .tsx — the number becomes something you HOLD rather than something you discover"
  - "A 375px assertion in jsdom must measure the thing that would CAUSE overflow (a 400px track beside a 375px viewport, content outside the scroll container), never a geometry jsdom cannot compute"

requirements-completed: []

# Metrics
duration: 74min
completed: 2026-08-09
---

# Phase 190 Plan 17: The Add/Edit Panel Summary

**Sketch 156-A ships whole — a 400px push/split panel that keeps the list visible, with the focus trap and focus restore a `Dialog` would have given free written as REAL code and asserted through `document.activeElement`; exactly 4 / 5 / 3 fields and nothing beyond them; an unconditional 🔒 destination footer derived during render; and a secret that is text on edit, never an input holding a fake value — and D-190-DEF-07's owed half is PAID in the commit that builds the panel, including a false footer line 190-16 did not name.**

## Performance

- **Duration:** ~74 min
- **Completed:** 2026-08-09
- **Tasks:** 3, in 2 commits (see deviation 1)
- **Files:** 7 (3 created, 4 modified) — **2 316 insertions, 13 deletions, ZERO file deletions** across both commits (`git diff --diff-filter=D --name-only HEAD~2 HEAD` prints nothing)

## Task Commits

| Task | Name | Commit |
|---|---|---|
| 1 + 2 | `ConnectionFormPanel.tsx` + `connectionFormCopy.ts` + the `ConnectionsTab` seam, **and the owed §9 fix** | `f84a45e6` |
| 3 | `ConnectionFormPanel.test.tsx` (31 cases) + BOTH count-gate knobs | `c83c82ab` |

---

# ⭐ THE OWED HALF OF D-190-DEF-07 — PAID, AND IT WAS LARGER THAN 190-16 NAMED

190-16 resolved UI-SPEC §2h via branch **(b)** — *the gate is right, the copy moves* — and handed this plan one named obligation: *"§9's panel notice inherits the same problem… Plan 190-17 must amend it in the commit that builds the panel, and must remove the panel's write affordances under the same OFF state."* Done, in `f84a45e6`.

**⚠ And there was a second false line 190-16 did not name.** §9 carried a `font-mono` `--warning` footer reading **`will save · will not send`** directly beneath the notice. It is the SAME promise, one line down, under the same 403 — so it moved with the notice. This is only visible by reading §9 rather than the pointer to it, which is why the pointer was not treated as the specification.

**What is rendered now** (`connectionFormCopy.PANEL_OFF_BODY` / `PANEL_OFF_FOOTER`, both asserted by character-identity):

> ⛨ **Live sending is off for this platform**
> This connection is read-only until an operator turns it on — it cannot be added or changed here, and nothing will leave: steps record what they would have done and read “Not sent — recorded”.
> An operator turns `live_connectors` on in the Control Room.
> `read-only · will not send`

**THE STRUCTURAL HALF, which is the part a copy-only fix would have missed.** While the switch is off the panel renders **no Save, no `Replace`, and static text instead of inputs** — REMOVED, not disabled. 190-16 MEASURED why the distinction is not stylistic (its plant C: a `disabled` Add button **passes** `toBeDisabled()`), so this plan drove the same shape here and — the step the plan's brief demanded — **checked it for REACH**:

```
plant E: {showSave && (…disabled={saving})  →  {canSubmit && (…disabled={saving || !showSave})
  × renders static text, no Replace and no Save — ABSENT, not disabled
  × every WRITE affordance is REMOVED while the switch is off, for an org admin
  expected document not to contain element, found <button …
```

Both cases go red, and both are ABSENCE assertions. A `toBeDisabled()` assertion would have passed on the defect twice.

**REVERSAL COST — now SIX edits, and they may never be separated:** 190-16's four (the three `require_visible` entries in `backend/app/api/connectors.py`, `test_190_connectors_api.py` case 9, §2h + `CONNECTIONS_BANNER_BODY`, `ConnectionsTab.tsx`'s affordance removal) **plus** §9's notice + footer with `PANEL_OFF_BODY` / `PANEL_OFF_FOOTER`, **plus** `ConnectionFormPanel.tsx`'s affordance removal. Recorded in three places: §9's own callout, `PANEL_OFF_BODY`'s docblock, and `deferred-items.md`.

**D-190-DEF-07 is now CLOSED IN FULL** — both surfaces that carried the false sentence say the same true thing, and both write surfaces remove rather than disable.

---

# ⭐ THE SECOND CORRECTION: §3d's `stored 3 Aug` IS NOT SHIPPED, AND THE SUBSTITUTION IS A MEASUREMENT

Sketch 156-A's secret row reads `•••••••••••••••• ········· stored 3 Aug [ Replace ]`. Measured against the shape that actually reaches this panel:

| Field | Present on `ConnectorConnection`? | Is it the secret's date? |
|---|---|---|
| `created_at` | yes | no — but a secret HAS existed since it, because `secret` is REQUIRED on create (`api.ts:5584`) |
| `updated_at` | yes | **no** — it moves on a RENAME as much as on a secret replace |
| any secret timestamp | **NO** | — |

Rendering `updated_at` beside the dots would date the credential from a field that is not about the credential — precisely the fabricated-timestamp error `connectionsCopy.credentialLabel` refuses ONE COLUMN AWAY (*"NEVER a fabricated timestamp"*, the 068-A honest-last-active rule). Refusing it there while committing it here would be the same lie with better manners.

**Shipped:** `stored since 3 Aug`, plus one line stating what is not known — *"That is when this connection was created. The date a credential was last replaced is not sent to this browser either."* §3d's verbatim NOTE is unchanged. §3d now carries the measurement and the reversal condition (a schema decision, not a copy one).

---

# ⭐ THE SECRET IS PROVEN ABSENT FROM EVERY SHAPE THAT REACHES THIS PANEL

Not asserted — enumerated, by reading each declared response interface and matching every field name against `secret|cipher|token|password|credential|key`:

| Shape | Fields | Secret-shaped |
|---|---|---|
| `ConnectorConnection` (list + get) | id · org_id · capability · name · config · is_enabled · last_checked_at · last_check_verdict · created_at · updated_at | **none** |
| `ConnectorCheckResult` (the check response) | ok · verdict · identity · host · port · checked_at · bucket · provider_message · reason_code | **none** |
| `SendEmailConnectionConfig` | host · port · from_address · username · tls | **none** |
| `CreateTicketConnectionConfig` | base_url · project_key · account_email | `project_key` — a **false positive** on `key`; it is Jira's issue prefix (`NW`), a non-secret the surface renders on purpose |
| `PostMessageConnectionConfig` | default_channel | **none** |
| `ConnectorApiError` | message · status · `reasonCode` | **none** — and `reasonCode` is the server's own code, never translated |

The real gate is one layer down and is stronger than any of this: `ConnectorConnectionResponse` (`backend/app/models/connector.py:253`) declares neither `secret` nor `secret_ciphertext`, is `extra='forbid'`, and its projection is fenced by a module-scope assert that makes adding one an **import failure** (190-06 drove that plant and observed it as a collection error, not an assertion failure).

**And the panel is defended independently of all of it.** `draftFromConnection` seeds `secret: ""` by construction, and a suite case renders an edit whose `config` is deliberately polluted with `secret_ciphertext: "enc:v1:xoxb-SENTINEL…"` — then sweeps the whole markup for `xoxb-`, `enc:v1:`, `secret_ciphertext` and `ciphertext`, and asserts `queryAllByDisplayValue` finds neither the sentinel nor the dots.

---

## The per-capability field counts — 4 / 5 / 3, asserted

| Capability | Fields | Count |
|---|---|---|
| `send_email` | Name · **SMTP host and port** (one field, a `1fr 92px` two-column row, two inputs) · Send from · App password | **4** |
| `create_ticket` | Name · Jira site · Project key · Account email · API token | **5** |
| `post_message` | Name · Channel · Bot token | **3** |

Asserted by `it.each` over `FIELD_COUNTS`, and driven RED by plant H (Slack grown a fourth "Webhook URL" field). **No CC field, no attachment field, no issue-type picker, no advanced section, no OAuth surface** — D-03 and D-32.

**`tls` is derived, not asked**, and that is what keeps `send_email` at four: 465 ⇒ implicit TLS, everything else ⇒ STARTTLS. `SendEmailConnectionConfig.tls` is a closed two-member union precisely because D-07 requires TLS either way, so nothing is lost by not asking — and the choice is never silent, because the 🔒 footer renders the resulting mode as a tag on every keystroke (asserted: typing `465` then `587` flips the tag live).

**The two verbatim sentences render and are asserted by character identity:** Slack's *"…it cannot be pointed anywhere else, by you or by a workflow"* and SMTP's *"Plain smtp:// is refused, including for addresses inside this network."*

---

## Verification (RUN, never quoted — every baseline re-measured at HEAD first)

| Check | Result |
|---|---|
| `npx vitest run …/ConnectionFormPanel.test.tsx` | **31 passed, 0 failed** (plan asks ≥ 9) |
| `node scripts/vitest-count-gate.cjs` | **`count gate OK` — 51/51 pinned files, no per-file decrease, `failed 0`**, total **2819**, pinned total **2806** |
| The new pin CATCHES a deletion | **`[count-decrease] ConnectionFormPanel.test.tsx — pinned 31, ran 30 (-1)`, exit 1** — driven, then restored md5-identical (`be10c957…`) |
| The suite was INVISIBLE to the gate before the TARGETS entry | **measured** — the gate ran green with the file on disk and its name absent from the printed list (50/50, total 2788) |
| `npx tsc --noEmit -p tsconfig.app.json \| grep -c "error TS"` | **33 → 33, unmoved.** Baseline RE-MEASURED at HEAD before a line was written, never quoted from a plan |
| `eslint src/components/settings/` | **5 → 5, unmoved.** All five pre-existing (`ProviderPicker.tsx` ×3 react-refresh, `ModelPillRow.tsx` ×2 static-components) |
| the eight D-23/D-24 fenced files | **blob-identical at base `de122b9a`, at HEAD, AND in the worktree** — existence confirmed first (`git cat-file -e` ×8 at both revs), then `git rev-parse <rev>:<path>` compared to `git hash-object` on disk. `git diff --numstat de122b9a` over all eight prints **nothing** |
| `git diff --numstat de122b9a -- frontend/package.json frontend/package-lock.json backend/requirements.txt` | **empty** — zero installs, zero shadcn blocks (T-190-SC) |
| `grep -c "title=" ConnectionFormPanel.tsx` | **0** — and the stronger check ships too: zero `[title]` nodes in BOTH the create and the edit render |
| `grep -c 'type="password"' ConnectionFormPanel.tsx` | **1** — the single create/replace site |
| `grep -cE "font-bold" ConnectionFormPanel.tsx` | **0** |
| `grep -c "Advanced" ConnectionFormPanel.tsx` · `connectionFormCopy.ts` | **0** · **0** |
| `grep -cE "400px\|gridTemplateColumns"` · `grep -cE "Escape\|keydown\|Tab"` · `grep -c "focus()"` | **3** · **8** · **4** |
| imports from `PhaseFormPanel` | **0** — asserted on the SOURCE via `?raw` over import lines only, with a positive control that the fence can see an import path at all |
| `ConnectionsTab.test.tsx` (190-16's suite) | **36/36 still green** — the seam change regressed nothing |
| `git diff --diff-filter=D --name-only HEAD~2 HEAD` | **empty** — neither commit deleted a file |
| `graphify update .` | 20 227 nodes / 54 104 edges rebuilt (untracked artefact; nothing entered a commit) |

### `npm test` — measured, attributed BY NAME, and NOT a regression

```
 Test Files  8 failed | 241 passed (249)
      Tests  21 failed | 4654 passed (4675)
```

**The eight failing files are byte-for-byte the set D-190-DEF-05 records** — `IngestionPage` · `MessageItem` · `Plan04.frontend` · `useMessages` · `StreamsProvider.dedup` · `streamsProvider` · `streamsProvider_075_9_clientkey` · `lib/model-info`, i.e. the chat/ingestion surfaces and the recorded **SEED-056 rot**. `ConnectionFormPanel.test.tsx` is not among them.

**The +33 is exactly accounted for**, which is the check that makes the attribution mean something: 190-16 read **4642 / 248 files**; 190-15 then landed **+2** (`ConnectionsTab.test.tsx` 34 → 36, visible in the gate's own pin); this plan adds **31** in **1** new file. 4642 + 2 + 31 = **4675** and 248 + 1 = **249**. No test was lost.

### ⚠ One thing that moved and is stated rather than smoothed

**Two early gate runs reported `failed 1` and I could not name the failing test.** The first of those runs happened **before** `ConnectionFormPanel.test.tsx` was in `TARGETS` — the gate was not executing it at all — so it cannot be attributed to this plan. Five consecutive runs since (three of them captured to files) report `failed 0` / `count gate OK`, and the intermittent failure never re-appeared to be named. Recorded here rather than omitted: an unnamed intermittent in a gate that requires 0 failing is worth the next reader knowing about, and the honest statement is *"seen twice, never reproduced, provably not this suite on at least one occasion"*, not *"green"*.

---

## The ten plants → RED cycles

The suite passed **31/31 on its first run**, which proves nothing on its own — so every load-bearing case was falsified against a **real plant in real production source**, applied by a `read_bytes`/`write_bytes` harness with the restore in a `finally`, the suite re-run, and every file verified md5-identical afterwards. `git status` on both targets is clean.

| # | Plant | Target | Observed RED |
|---|---|---|---|
| A | `event.preventDefault()` dropped from BOTH Tab branches, so `focus()` runs and the browser advances anyway | `ConnectionFormPanel.tsx` | `Failed Tests 2` |
| B | the restore cleanup no longer calls `opener.focus()` | `ConnectionFormPanel.tsx` | `Failed Tests 2` |
| C | the connections `<section>` goes `aria-hidden` while the panel is open — the dialog defect | `ConnectionsTab.tsx` | `Failed Tests 1` |
| D | the dots become an `<input type=password readOnly value={SECRET_DOTS}>` — a fake value the DOM holds | `ConnectionFormPanel.tsx` | `Failed Tests 4` |
| E | **Save rendered `disabled={saving \|\| !showSave}` instead of REMOVED** | `ConnectionFormPanel.tsx` | `Failed Tests 2` |
| F | the footer hidden until a host is typed — a conditional destination line | `ConnectionFormPanel.tsx` | `Failed Tests 2` |
| G | the footer derived ONCE (`useMemo(…, [])`) and held stale | `ConnectionFormPanel.tsx` | `Failed Tests 3` |
| H | Slack grows a fourth field (an incoming-webhook URL) | `ConnectionFormPanel.tsx` | `Failed Tests 1` |
| I | the footer value copies `ProviderPicker.tsx:211`'s `title` truncation affordance | `ConnectionFormPanel.tsx` | `Failed Tests 1` |
| J | the panel imports `@/components/workflows/PhaseFormPanel` | `ConnectionFormPanel.tsx` | `Failed Tests 1` |

**Plant E is the one to read**, and it is the one the brief said to check for REACH rather than for RED — the two failures are named above, and both are absence assertions.

**Plant A is the second one to read.** Without the `<button data-testid="outside-control">` rendered beside the panel, both trap cases would pass on a panel that merely has one focusable child; the trap is asserted as *focus is still inside the panel AND it wrapped AND it is not the outside control*.

---

## Files Created/Modified

- **`frontend/src/components/settings/ConnectionFormPanel.tsx`** *(created, 899 L)* — the panel. Its header records why 156-A won on placement, why Radix `Sheet` is NOT reused for the mobile half, the two MIRRORED `PhaseFormPanel` type rules with their line citations, the inherited off-grid spacing exceptions (so a later round does not "correct" them into a fence break), and the no-`title` rule.
- **`frontend/src/components/settings/connectionFormCopy.ts`** *(created, 528 L)* — every user-visible string as an exported identifier, plus the pure derivations (`draftFromConnection`, `configFromDraft`, `tlsModeOf`, `refusalOf`, `destinationFooterOf`, `secretStoredLabel`, `orgSharedLine`, `capabilityLabelOf`, `FIELD_COUNTS`). 70 `export const`s.
- **`frontend/src/components/settings/__tests__/ConnectionFormPanel.test.tsx`** *(created, 665 L)* — 31 cases in eleven groups.
- **`frontend/src/components/settings/ConnectionsTab.tsx`** *(+~90 / −13)* — the `panel?: ReactNode` slot, the push/split grid, an inline `useIsMobile`, and the container's `onAdd` / `onOpen` / `onCreate` / `onUpdate` wiring plus the org-name read.
- **`scripts/vitest-count-gate.cjs`** *(+~50)* — one `TARGETS` line and one `BASELINE` pin at 31, each with the measurement that justified it.
- **`190-UI-SPEC.md`** *(+~55 / −10)* — §9's notice + footer, §3d's measured substitution, and §2h's pointer flipped to PAID.
- **`deferred-items.md`** *(+~20)* — D-190-DEF-07's owed half struck through and closed with the six-edit reversal cost.

## Decisions Made

1. **D-190-DEF-07's owed half paid, branch (b) extended not re-litigated** (above), including the footer 190-16 did not name.
2. **§3d's `stored 3 Aug` substituted on measurement** (above).
3. **Radix `Sheet` NOT reused for the mobile bottom sheet.** It is `Dialog` underneath and brings its own focus trap; two traps competing for one subtree is how a keyboard user ends up unable to leave. One `<aside>` with `data-layout="split" | "sheet"`, one trap, one restore, both layouts asserted.
4. **The trap is a NATIVE listener, not an `onKeyDown` prop** — measured: the prop form takes `eslint src/components/settings/` 5 → 6 on `jsx-a11y/no-noninteractive-element-interactions`, and the rule is right that an `<aside>` is not becoming interactive. Nothing about the behaviour changes; `preventDefault()` on the native event is exactly what `userEvent.tab()` reads.
5. **`tls` derived from the port** (above) — it is what keeps `send_email` at the four fields §3b binds.
6. **The `refused` tag claims only what the text proves.** The server refuses by RESOLVING an address (`egress.py: refuse_reason`); a browser cannot resolve. So `refusalOf` recognises a plaintext scheme and a loopback/private/link-local literal, and everything else renders **no verdict at all** rather than a green one — with `FOOTER_SERVER_NOTE` naming the mechanism, per copy rule 5. §3c's own `smtp.internal.northwind.co:587 [refused]` example is therefore **not** reproducible client-side, and saying so is the point.
7. **A second sibling copy module rather than exports from the `.tsx`** — 190-12 measured the alternative at eslint 5 → 10; 190-16 took the fix; measured here before and after, `src/components/settings/` stays at **5**.
8. **The panel opens READ-ONLY for a non-admin rather than not opening.** A member may legitimately need to see WHERE a connection they can bind sends — that is the whole purpose of the 🔒 footer — so `onOpen` still fires and the write affordances are the thing that is absent (U-02).

---

## Deviations from Plan

### 1. [RECORDED — Tasks 1 and 2 share ONE commit]

Both tasks author the same NEW file. A shell-only intermediate would be a state fabricated to satisfy a commit count rather than a state this plan ever meant to ship, and hand-trimming a 700-line file backwards and re-expanding it is real risk bought for zero traceability. Both task IDs are named in the commit message. Task 3 has its own commit.

### 2. [Scope — a fourth file, deliberately] `connectionFormCopy.ts` is not in `files_modified`

The plan's Task 2 criterion is `grep -c "export const" ConnectionFormPanel.tsx >= 10`. Taken as its INTENT — *"every user-visible string in this file is an exported identifier"* — and satisfied in the sibling module, which is what phase_critical_rule 6 and 190-16's own "Next Phase Readiness" row (*"the panel's own copy module beside it"*) both direct. **Measured rather than preferred:** `eslint src/components/settings/` reported 5 before this file existed and 5 after. `grep -c "export const" connectionFormCopy.ts` = **70**.

### 3. [Rule 3 — blocking] the `onKeyDown` JSX prop trips `jsx-a11y/no-noninteractive-element-interactions`

- **Found during:** Task 1, first eslint measurement after the trap landed (5 → 6).
- **Fix:** the handler moved to a native `addEventListener` on the panel node inside an effect. Behaviour unchanged, the reason recorded in the code.

### 4. [Rule 1 — bug] `OrgValue` has no `memberships` field

- **Found during:** Task 1, reading the org name for §3e's line. `tsc` 33 → 35 (`Property 'memberships' does not exist`, plus an implicit `any`).
- **Fix:** the shipped field is `OrgValue.orgs` (`OrgProvider.tsx:46`). Re-pointed; `tsc` back to 33. An unresolved name degrades to `your organisation` — the same sentence, name-free — never a blank.

### 5. [RECORDED — four acceptance greps were satisfied by rewording COMMENTS, and the DOM check is the real guard]

`font-bold`, `title=`, `type="password"` and `Advanced` each appeared once or twice in **docblock prose** (citing the shipped Settings-card rule, citing `ProviderPicker`'s truncation affordance, labelling the password site, and stating the §3c rule). The literal greps the plan specifies cannot tell a comment from code. Both halves were done: the comments were reworded so the greps pass literally (`0 / 0 / 1 / 0`), **and** the properties are asserted on the RENDERED DOM — zero `[title]` nodes in both renders, zero `input[type=password]` in edit mode, driven RED by plants I and D. A source grep could not have caught a `title` arriving through a spread; the DOM assertion does.

### 6. [RECORDED — a plan acceptance criterion is unsatisfiable as written]

Task 3 asks for `cd frontend && npm test` to report `0 failed`. Measured: **21 failed / 4654 passed** across the eight files D-190-DEF-05 already records, attributed **by file name** and with the +33 delta fully accounted. Not this phase's signal (D-190-DEF-05 / -06); the honest instrument is `node scripts/vitest-count-gate.cjs`.

### 7. [RECORDED — two planning documents edited, both mandated]

`190-UI-SPEC.md` and `deferred-items.md` are outside `files_modified`. The orchestrator's brief made the §9 edit **mandatory and same-commit**; D-190-DEF-07's own re-open trigger required the deferred entry to be closed with the chosen half named.

### 8. [RECORDED — the 375px case is a STRUCTURE assertion, and says so]

jsdom computes no layout, so "no horizontal overflow" cannot be measured as geometry. It is asserted as the thing that would CAUSE it: at `innerWidth = 375` the panel's `data-layout` is `sheet`, the split track contains **no** `400px`, the tallest content (the OFF notice) is inside the `overflow-y-auto` body, and the panel is `max-h-[85vh]`. The real hook is driven (`window.innerWidth` + a `resize` event), not stubbed, so the shipped code path is what is measured. **A rendered-geometry check at 375px is owed to manual UAT** and is named in Next Phase Readiness.

**Total deviations:** 2 auto-fixed (Rules 1 and 3), 1 deliberate scope addition, 5 recorded notes. **Zero packages installed.**

## Issues Encountered

- **The plant harness needed `sys.stdout.reconfigure(encoding="utf-8")`** — 190-16 recorded this and it bit again on the first run: Windows `cp1252` cannot encode vitest's output or this surface's glyphs, and the harness died in the print AFTER the `finally` had restored the file, which is why the abort was harmless.
- **Two early count-gate runs reported `failed 1` with no nameable file**; not reproduced in five subsequent runs, and one of the two predates the suite's registration entirely. Recorded above rather than smoothed.

## Threat-model dispositions honoured

| Threat ID | How it was met |
|---|---|
| **T-190-17-SECRET** | A `font-mono` `<span>` of dots on edit, never an `input[type=password]` with a fake value — asserted BOTH ways (`querySelectorAll('input[type=password]')` is 0, `dots.tagName` is `SPAN`), plus a whole-markup sweep for `xoxb-` / `enc:v1:` / `secret_ciphertext` / `ciphertext` against a row whose config was deliberately polluted with a sentinel, plus `queryAllByDisplayValue` finding neither the sentinel nor the dots. Driven RED by plant D (4 failures). The response model that makes it true is enumerated above |
| **T-190-17-DEST** | The footer is rendered ALWAYS — present on the FIRST render before a keystroke, reading `nothing yet — fill the fields above` rather than disappearing — derived during render via `destinationFooterOf`, never held in state, and proved to follow the fields (host, port→TLS-mode, capability). A provably-refused destination carries `data-refused="true"`, the `--destructive/50` border, the `refused` tag and a reason line. Driven RED by plants F (conditional) and G (stale) |
| **T-190-17-FOCUS** | A real trap and a real restore, asserted via `document.activeElement` with a control rendered OUTSIDE the panel so the assertion cannot pass vacuously; restore asserted for BOTH exits (Escape, and close-after-successful-save). Driven RED by plants A and B |
| **T-190-17-U02** | Static text, no `Replace`, no Save, zero `<input>` nodes — asserted as ABSENCE, with a positive control that an admin on a live platform gets all three. Driven RED by plant E. The API `require_org_manage` gate remains the wall |
| **T-190-17-D23** | `PhaseFormPanel.tsx` blob-identical at base, HEAD and worktree; `git diff --numstat` empty; the two type rules MIRRORED with citations; zero imports, asserted on the SOURCE over import lines with a positive control. Driven RED by plant J |
| **T-190-17-SCOPE** | Exactly 4 / 5 / 3 fields, asserted by `it.each` over `FIELD_COUNTS`; no OAuth surface, no advanced section, no extra vendor field. Driven RED by plant H |
| **T-190-SC** | Zero installs, zero shadcn blocks. `git diff --numstat de122b9a` on `package.json` / `package-lock.json` / `requirements.txt` is empty |

## Known Stubs

**None.** Every control this panel renders is wired to a real handler, and every control it does NOT render is absent because a write is genuinely impossible in that state (non-admin, or the kill-switch off) — which is the shipped 185 removed-not-disabled rule, not a stub.

Two things are deliberately **out of this plan's surface and owned by 190-18**, per D-32 and the plan's own objective: the six closed refusal sentences of §4c plus §4b's two refusal blocks (this panel ships ONE generic `Couldn’t save that — try again.`), and the check moment §5c draws. The panel's save path surfaces the server's `reasonCode` unchanged, so 190-18 keys into the closed map without this plan having invented a seventh sentence.

## Threat Flags

**None.** This plan adds no network endpoint, no auth path, no file access and no schema. It calls two writes 190-09 already gated (`createConnectorConnection`, `updateConnectorConnection`) and reads nothing new.

## Cloud parity (D-22)

**Nothing new is owed.** No env var is read, no reference data is seeded, no bundled service is added and no sandbox tag changes. The standing queue is unchanged at **`099 → 117` + `SECRETS_ENCRYPTION_KEY`**. The `live_connectors` non-code half is unchanged and still recorded under D-190-DEF-09 (no Control Room card for it yet).

## Next Phase Readiness

**Ready.** What downstream plans can assume, and what they owe:

| Owed by | What |
|---|---|
| **190-18** | The refusals, the check moment and the destructive guards. `connectionFormCopy.ts` is the established home for a panel string; the save path already surfaces `ConnectorApiError.reasonCode` verbatim, so §4c's closed map keys off the server's own code. §4b's `no_encryption_key` branch must DISABLE Save with its reason wired by `aria-describedby` — note that is the ONE place §11d asks for `disabled` rather than removed, because there the control is meaningful and its refusal is the message |
| **manual UAT** | **A rendered-geometry check at 375px.** jsdom computes no layout, so the shipped test asserts the causes of overflow, not overflow itself (deviation 8). Drive the panel at a real 375px viewport and confirm the OFF notice and the org-shared line are both reachable |
| **`/gsd:verify-work 190`** | Do **not** read `npm test` as a regression signal (D-190-DEF-05 / -06). Use `node scripts/vitest-count-gate.cjs` (51 files, `failed 0`, total 2819) plus the per-suite runs |
| **A `/gsd:quick`** | **D-190-DEF-09** — widen `GovernedFeature`, add the five map keys, author the `FeatureVisibility.FEATURES` card. Still open; this plan reuses 190-16's fail-closed reader unchanged |

**Three things not to re-litigate:** the D-190-DEF-07 branch (its reasoning and its now-six-edit reversal cost are written in four places), §3d's `stored since` substitution (reversible only by a schema change that gives the response a real secret timestamp), and the count-gate registration (both knobs moved, the pin proved to catch a deletion, and the remaining `+13` drift is 190-16's two recorded pre-existing under-pins, untouched).

---
*Phase: 190-live-connector-slice-connector-security-stretch*
*Completed: 2026-08-09*

## Self-Check: PASSED

| Claim | Command | Result |
|---|---|---|
| `ConnectionFormPanel.tsx` exists | `[ -f … ]` | **FOUND** (899 L) |
| `connectionFormCopy.ts` exists | `[ -f … ]` | **FOUND** (528 L) |
| `ConnectionFormPanel.test.tsx` exists | `[ -f … ]` | **FOUND** (665 L) |
| `190-17-SUMMARY.md` exists | `[ -f … ]` | **FOUND** |
| commit `f84a45e6` (Tasks 1+2) | `git log --oneline --all \| grep` | **FOUND** |
| commit `c83c82ab` (Task 3) | `git log --oneline --all \| grep` | **FOUND** |
| the suite is registered on BOTH gate knobs | `grep -c "ConnectionFormPanel.test.tsx" scripts/vitest-count-gate.cjs` | **3** (one `TARGETS` line, one `BASELINE` key, one in the notes) |
| no commit deleted a file | `git diff --diff-filter=D --name-only HEAD~2 HEAD` | **empty** |
