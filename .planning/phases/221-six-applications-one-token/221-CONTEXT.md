# Phase 221 — Six Applications, One Token · CONTEXT

**Opened** 2026-08-31. **Milestone** v3.9 Connections: Any Service, Any Tool.
**Design authority:** `.planning/sketches/221-six-applications-one-token/index.html` —
**operator-approved 2026-08-31, D1–D12, rev 2.** G-2 is SATISFIED, not overridden.

> ⚠ **Numbering:** this work was sketched as "219" for one afternoon. **219 is taken**
> (*A Connected Source Feeds the Library*). The sketch folder was renamed; any note
> referring to "sketch 219" means this phase.

---

## The one sentence

> Google Workspace is **six applications under one connection** — Drive, Gmail, Sheets, Docs,
> Calendar, Contacts — and inside each, reads and writes separate. Application is the first axis,
> direction is the second, and **the direction band grants nothing**.

---

## Measured facts this phase is built on — do NOT re-derive them from stale prose

Every figure below was measured on 2026-08-31 against the live local stack, not reasoned about.

- ✅ **15 Google tools, 6 egress keys.** Derived from `SERVICE_TOOL_SPECS["google"]`:
  `drive_read` 2 · `gmail_read` 5 · `sheets_read` 2 · `docs_read` 1 · `calendar_read` 4 ·
  `contacts_read` 1. The grouping the operator asked for already exists as this key.

- ⛔ **AND IT DOES NOT REACH THE BROWSER.** `extra_descriptors_for_service`
  (`service_tools.py:798`) strips it **on purpose**, and says so: *"The execution fields
  (`capability`, `http_method`, `path` / `api_method`, `writes`) are STRIPPED here rather than
  carried through. They are ours, they are not part of any tool contract."* **That reasoning is
  correct and this phase does not reverse it** — see D-221-07.

- ✅ **All six Google APIs are now enabled** in Cloud project `877112366454` (operator enabled
  Sheets, Docs, Gmail, Calendar and People during the session). Probed directly:
  Drive 200 · Gmail 200 · Sheets 404-answered · Docs 404-answered · Calendar 200 · People 200.

- ⚠ **Earlier the same day three of the six were `SERVICE_DISABLED` and the connections panel
  said nothing about any of them.** The only way to find out was to run a tool in chat and read
  the refusal. **That is the defect D-221-04 exists to close, and it is one console toggle from
  being true again.**

- ✅ **10 of 15 actions returned real data** on the re-drive: `search_files` `read_file`
  `search_email` `read_email` `list_labels` `read_thread` `list_calendars` `list_events`
  `find_free_time` `search_contacts`. Four had no data in the account
  (`read_attachment` `list_sheet_tabs` `read_sheet` `get_event`). **One is a genuine defect:**
  `read_doc` handed a `.docx` Drive id returns a bare `HTTP 400 FAILED_PRECONDITION` — and a model
  will do exactly that, because `search_files` returns `.docx` and native-Doc ids side by side.
  → `SEED-228`, NOT in this phase's scope.

- ✅ **GitHub is the single-application case, with real numbers:** `discovered_tools` on the live
  row holds **44 tools — 27 `readOnlyHint: true`, 17 false.** That is the shape the Rovo screen
  the operator screenshotted has, and D-221-09 says one component renders both.

- ⚠ **THE GRANT LADDER IS TWO-DEEP TODAY.** `resolve_effective_posture`
  (`connectors/grants.py:36`) reads `tool_grants[tool_name]`, else `default_approval_posture`,
  else denies. There is no middle rung and no key namespace.

- ⚠ **`_sanitize_tool_grants` REFUSES rather than coerces, and that is load-bearing.**
  `connector_service.py:303` raises `ValueError` → 422 for any value outside
  `{"allow","ask","deny"}`, because the old `bool(v)` coercion turned a person's **Deny into an
  Allow** (`{"delete_repository": "deny"} → True`, driven 2026-08-27). It validates VALUES and
  passes every KEY through `str(key)`. **An `app:` key therefore already survives it** — D-221-05
  adds a key-shape assertion so an unknown namespace cannot be invented silently.

- ⚠ **ICON PACKS: THREE OF SIX MARKS EXIST, NOT SIX.** Measured against installed
  `@iconify-json/logos@1.2.13`, `@iconify-json/vscode-icons`, `@lobehub/icons@5.10`:
  | app | slug | size | ratio | verdict |
  |---|---|---|---|---|
  | Drive | `logos:google-drive` | 256×229 | 1.12 | ✅ |
  | Gmail | `logos:google-gmail` | 256×193 | 1.33 | ✅ |
  | Calendar | `logos:google-calendar` | 256×256 | 1.00 | ✅ |
  | Sheets / Docs / Contacts | — | — | — | ⛔ **absent from all three packs** |
  Ratios are all near-square, so `connectionMark.tsx`'s letterboxing trap (ratio ≥ ~2.7) does not
  apply to any of the three. **The plan must not promise six marks.**

- ⚠ **`readOnlyHint` was measured ABSENT in the wild** (DeepWiki sends no `annotations` on any of
  its three tools). D-221-11 is the consequence.

---

## Decisions — approved by the operator 2026-08-31

### D-221-01 · Six applications, never six authentications
One connection, one token, one consent, one Revoke. Six separate connections would mean six consent
screens, six refresh tokens, six list rows for one Google account and six places to revoke — and
while the consent screen is in **Testing**, six refresh tokens that each expire independently every
7 days.

It would also reverse a direction already written into the code. `service_tools.py` records the
operator's BUS-037 §B instruction verbatim: a `gmail` service id *"would have meant a second row, a
second consent and two places to revoke."*

**The real benefit of separate auth is obtained another way: incremental consent.** Grant Drive now,
add Calendar later, same connection, same token. → D-221-04's scope arm offers exactly this.

### D-221-02 · Application is the first axis; direction is the second
Claude.ai groups Rovo purely by direction because Rovo has **one axis** — a single product surface.
Google is six products, six APIs, six scopes and six **independent** failure modes; three were
switched off separately this morning and enabled separately this evening. Direction cannot express
*"Calendar is switched off"*; application can. **Organise on the axis the failures arrive on.**

### D-221-03 · ⛔ THE DIRECTION BAND CARRIES NO POSTURE CONTROL
The one part of Claude.ai's design deliberately **not** copied. Their *Read-only tools · 22* group
carries its own `Needs approval` dropdown — one click, twenty-two tools, keyed on direction.

The ROADMAP forbids exactly that, in these words (`ROADMAP.md:248`):

> **"The run-time gate may key on direction; the grant-time gate must NOT"**, because a read is
> exactly where prompt injection enters.

The band **groups and counts. It does not grant.** The bulk control lives on the application, where
the axis is the product and not the direction. A test must plant a posture control in a band and
observe it RED.

### D-221-04 · The availability line, and its three states
Three different things stop an application working and today they are indistinguishable until a tool
fails in chat: **the Cloud API is off** · **the scope was never granted** · **it works.** The first
two have *opposite* remedies — one is a console visit where reconnecting is useless, the other a
scope grant where the console is useless.

- A working application **says nothing at all.** Silence is the healthy state (noise audit, item C1).
- A blocked one names **the remedy**, not a status.
- Filled from the existing **Check** action, which today only verifies credentials. One check, six
  verdicts, cached beside `last_check_verdict`.

### D-221-05 · Three permission levels, matching the three grouping levels
`action → application → connection default`. Stored as an `app:<key>` entry inside the existing
`tool_grants` object — **no new column, no migration.** `resolve_effective_posture` gains one lookup
between its two existing steps and keeps failing closed.

### D-221-06 · ⛔ An application's Allow NEVER reaches its writes
Setting Drive to **Allow** must not arm `create_file`. A write starts at Ask; only an explicit
per-action Allow moves it. **Built and tested in this phase even though no write tool exists yet** —
retrofitting this onto a shipped Allow that already cascades is far more expensive than asserting it
now against a planted write tool.

### D-221-07 · One backend field, and it is NOT `capability`
Add a separate presentation-safe `app` key to each spec and emit it beside `title`. It carries no
host, no path, no method. The existing strip of the execution fields stays exactly as it is.

### D-221-08 · Marks: three real, three monogram — CORRECTED BY MEASUREMENT
The sketch recommended six distinct product marks. **Only three exist** in the installed packs (see
measured facts). Drive, Gmail and Calendar get their real marks; Sheets, Docs and Contacts fall back
to the monogram tile — which is the fallback the decision already specified, so the decision holds.
⛔ **No new icon dependency is added without a separate operator decision.**

### D-221-09 · One component, both shapes
A connector's applications are *the distinct values of the `app` key across its tools*. Google
resolves to six; GitHub, Jira, Notion and every MCP server resolve to one. When there is exactly
one, its header is redundant — the connection header already names it — so it collapses and the
direction bands rise to the top. **That is `apps.length === 1` skipping one row, not a second
component.**

### D-221-10 · The search box stays, above the groups
Filtering across all groups, with groups matching nothing hidden while a search is active. Google at
15 does not need it and Google at 30 will; **one behaviour at 15 and at 44 beats a box that appears
at a threshold nobody can predict.**

### D-221-11 · ⛔ Direction is never INFERRED where it is unknown
`readOnlyHint` was measured absent in the wild and the MCP spec says an unannotated tool is to be
treated as destructive. A connector whose tools carry no hint gets **no direction bands at all** —
one ungrouped list — rather than a silently wrong *"Only reads"* heading. **Absence is not a third
band; it is the absence of banding.**

### D-221-12 · The row verdict is DERIVED, so "Ready" stops being a lie
Google stays one row and gains a count plus a derived verdict, so when an API goes off again it
reads **Partly ready · 3 need attention** with nobody maintaining a flag. The same rule fixes
**Microsoft 365**, which today shows *OAuth connected · ✓ Ready* with **zero tools** — an
`oauth_byo` row that never completed discovery. A connection with no usable actions is
**Not usable**, not Ready. This closes the operator's open item #4 as a side effect.

---

## G-5 — the ledger scan, RE-DERIVED rather than read

Run against this phase's `files_modified` on 2026-08-31 with CLAUDE.md's own recipe
(`git log --follow`, six-digit dated-quick-task buckets subtracted):

| File | commits / phases / lines | G-5 | Ledger row said | Disposition |
|---|---|---|---|---|
| `settings/ConnectionGrantsList.tsx` | 4 / 1 / 344 | no (1 phase) | ⛔ **NO ROW AT ALL** | ⭐ **the real obligation** — see below |
| `settings/ConnectionFormPanel.tsx` | 15 / 6 / 2316 | ⚠ FIRES | `9 / 5 / 2009` — **STALE** | honoured by construction: one prop added at one mount site |
| `settings/ConnectionsTab.tsx` | 21 / 7 / 1500 | ⚠ FIRES | `17 / 7 / 1477` | honoured by construction: the row verdict is a DERIVED string, no branch added |
| `settings/connectionsCopy.ts` | 12 / 6 / 638 | ⚠ FIRES | `8 / 6 / 573` — stale | additive to a vocabulary — the right shape for one |
| `lib/connectionMark.tsx` | 8 / 4 / 315 | ⚠ FIRES | `7 / 4 / 313` | additive: 3 map entries |
| `services/connector_service.py` | 16 / 5 / 1461 | ⚠ FIRES | `7 / 3 / 1149` — **STALE** | honoured by construction |
| `lib/api/org.ts` | 6 / 4 / 562 | ⚠ FIRES | ⛔ **NO ROW AT ALL** | one optional field on one type |
| `connectors/service_tools.py` | 6 / 0 / 1456 | no | ⛔ **NO ROW** | 15 keys + 1 projection line |
| `connectors/grants.py` | 1 / 1 / 92 | no | ⛔ **NO ROW** | the middle rung, ~10 lines |

⚠ **TWO ROWS WERE MEASURED STALE AND FOUR FILES HAVE NO ROW AT ALL** — including
`ConnectionGrantsList.tsx`, the file this phase changes most. That is the exact failure CLAUDE.md's
completeness rule exists to prevent: *a hot file missing from the scan list is permanently invisible
to its own guardrail.* **Rows for all four are added in this phase's first commit**, with their
sections in `docs/HOT-FILE-LEDGER.md` in the SAME commit.

### The G-5 verdict, and it is not "no rule fires so proceed"

`ConnectionGrantsList.tsx` does **not** fire G-5 — it is one phase old. But it is 344 lines and this
phase roughly **doubles** it, which is how every file in that ledger got hot in the first place.

⛔ **So the seam is taken BY CONSTRUCTION, inside this phase, rather than deferred to a refactor
phase that would have to undo a 700-line component first.** The grouping is built as pure leaves and
small children from the start:

| New file | What it is |
|---|---|
| `settings/toolGroups.ts` | the PURE leaf — group tools by `app`, then by direction; the ladder resolver; zero JSX |
| `settings/ApplicationGroup.tsx` | one application: header, posture control, availability line, children |
| `settings/DirectionBand.tsx` | the band — label + count and **nothing else** (D-221-03 by construction) |
| `settings/ActionRow.tsx` | one action row, EXTRACTED verbatim from the existing `.map()` body |

`ConnectionGrantsList.tsx` is expected to **shrink**, not double: it keeps the default-posture card,
the search box and the composition, and hands every row to a child. **A summary reporting it grew is
reporting that this decision was not honoured.**

---

## Scope fence

**IN:** the six-way split, the direction bands, the application posture rung, per-application
availability, the derived row verdict, the three marks, the ledger rows.

**OUT, and each has a home:**
- **Writes per application** — step 2 of the operator's order, a later phase. This phase builds
  D-221-06's rule and tests it against a planted write tool; it ships no write.
- **The integration roadmap page** — step 3, not a code phase.
- **`read_doc` on a `.docx`** → `SEED-228`.
- **Microsoft 365's absent discovery** — D-221-12 makes the row HONEST; it does not repair the row.
- **Incremental consent plumbing** — D-221-04's scope arm renders the offer; the OAuth
  `include_granted_scopes` work is its own phase.
