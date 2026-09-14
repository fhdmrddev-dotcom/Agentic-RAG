---
phase: 240-mail-is-a-shape-not-a-fourth-adapter
verified: 2026-09-09                # the date this file's own header already carries
verification_mode: self-verified   # ⛔ OV-SOLO-01 / D-245-01 — NEVER "reviewed". No independent §6.3 reviewer exists.
independent_review: partial       # ⚠ CORRECTED 2026-09-14 — was `owed # nobody who did not shape this build has looked at it`, and that was FALSE. `240-REVIEW-BUILD.md` carries `review_type: independent` over the BUILD range (50f66ec39..962dfdfce^, 21 files, 2 Critical + 8 Warning + 6 Info). ⛔ What is genuinely uncovered is the REVIEW-RESPONSE range — notably 9e83203a2, which changed sources/base.py (+23) and watch_service.py (+28/-1) AFTER both reviews. 240-REVIEW.md must NOT be counted: it carries no review_type field. Full measurement: 240-REVIEW-RECONCILIATION.md (measurement, NOT a review — claude built this phase).
---

# Phase 240 — Verification

**Date:** 2026-09-09
**Base commit:** `50f66ec39`
**Plans:** 4, across 3 waves — `240-01`, `240-02` (wave 1), `240-03` (wave 2), `240-04` (wave 3)

---

## ⛔ THIS IS A SELF-VERIFICATION, AND IT SAYS SO IN ITS FIRST PARAGRAPH

**I discussed, planned, built and verified this phase alone.** The operator directed an unattended
end-to-end run on 2026-09-09 and told me Gemini is unavailable. `AGENTS.md` §6.3 and CLAUDE.md both
require that *whoever REVIEWS a phase must not have shaped the build*, so that requirement is
**unmet by construction** — `OV-240-01`.

⚠ Phase 238 sits in exactly this state with a review still owed. **Phase 240 now makes two.**
The single independent gate available is `/code-review ultra`, which is operator-triggered and
billed; I cannot launch it. It is proposed, not claimed.

---

## The headline claim, and the hash that supports it

Phase 240's title is a claim: **mail is a shape, not a fourth adapter.** A claim of that kind is
worth exactly what can refute it, so it was measured three ways rather than asserted.

| Claim | Evidence | Result |
|---|---|---|
| The source contract does not change | `md5sum backend/app/services/sources/base.py` before and after | **`3b3d8770a6c9309f0635503d155dd8f7` both times** · `git diff --numstat` prints nothing |
| No fourth adapter | `SourceRegistry.list_supported_services()` contains no `mail|gmail|imap|outlook` key | ✅ |
| Mail rides the existing adapter | a Google connection still resolves to `GoogleDriveSourceAdapter` | ✅ (positive control) |
| The delegation is cheap | `git diff --numstat -- adapters/google_drive.py` | **+35 / −0**, ~20 of them comment |
| The provider-independent half really is | `mailbox.py` added to `test_boundary_fence.py`'s `FENCED_MODULES` | ✅ mechanical, not a promise |

⭐ **The fence was DRIVEN RED three ways before it was trusted.** A planted
`SourceFile.thread_id` failed by field-name; a planted `gmail` registry key failed by key-name; a
planted `gmail` string in `base.py` failed by word. `base.py` was then restored and proven
identical by md5. *A guard nobody has seen fire is one person's word.*

⚠ **The registry-key fence's FIRST planted defect did not fire** — I planted a `PROTOCOL_ADAPTERS`
row, which is not a registry key. The test was right and the plant was wrong; a correct plant
(registering an adapter under `gmail`) then fired by name. Recorded because *"I drove it red"* is
only meaningful if the plant was the thing the fence claims to catch.

---

## Success criteria

### SC#1 — an answer cites the message that said it, ONCE ✅ **MET, by measurement**

Not assumed. A 14-message thread fixture where every reply quotes message 1's distinctive
paragraph, run through `strip_quoted_replies` (which already runs BEFORE chunking):

| Quote dialect | Bodies carrying the paragraph BEFORE stripping | Documents carrying it AFTER |
|---|---|---|
| Gmail (`On … wrote:` + `>`) | **14 / 14** | **1** |
| Outlook (`From:` / `Sent:` block) | **14 / 14** | **1** |
| `-----Original Message-----` | **14 / 14** | **1** |

⭐ **Driven RED:** with `strip_quoted_replies` replaced by the identity function the count is
**14**, and the test asserts that too. A suite that cannot fail proves nothing (Phase 236 SC#2).
⭐ **The positive control runs every time**, not once by hand: if the fixture ever stops poisoning
all fourteen bodies, the measurement is measuring nothing and says so.

⛔ **`retrieval_service.py` was NOT modified**, and `git diff --numstat` on it prints nothing. It
fires G-5 at 10 phases with an extraction owed since Phase 231, and ROADMAP row 241 states a third
landing must propose the extraction first. Since the measurement came out green, no retrieval
change was needed — the "~80% already ships" claim in ROADMAP 240 holds for SC#1.

### SC#2 — attachments are documents of their own, findable both ways ✅ **MET — and it was FALSE before this phase**

⛔ **THE PHASE'S MOST CONSEQUENTIAL FINDING, measured before planning started.**

```
grep -n "rfc822\|attachment" backend/app/services/ingest_splice.py
→ one docstring line, and no code.
```

The loop that mints attachments as child documents and writes the `attached_to` relationship lived
**only** in `api/documents.py`'s legacy `ingest_document`. **Watches and `/upload` both run the
queue path.** So a watched mailbox would have ingested fourteen messages and **zero attachments**,
SC#2 would have been false, and the whole suite would have stayed green — because every existing
attachment test exercises the legacy path.

⚠ **This is the FOURTH recorded disagreement between these two paths.** `ingest_splice.py`'s own
comments narrate the first three: BUG-260905-06 (metadata never ran on the queue path), the
empty-chunk refusal, and the Phase 234 provenance carry. Each was found by someone going looking.

**Fixed the way the previous three were:** one function (`services/email_attachments.py`), both
callers. `api/documents.py` **+15 / −115**.

⭐ **Proven to be a MOVE, not a rewrite.** The legacy pin was written and passing BEFORE the
extraction and passes unchanged after. ⛔ Had it needed editing, the move changed behaviour and the
edit would have been the failure.

⭐ **ROADMAP 240's named failure mode — *"two different emails carrying the same attachment collide
on `documents_dedup_idx` and one is silently swallowed"* — does not happen**, and the reason is
structural: the relationship insert sits ABOVE the `is_duplicate` early-return. **Driven RED by
moving it below** — the second link vanished and the test failed by name.

⚠ **NEW EXPOSURE, GUARDED IN THE SAME COMMIT:** running this loop on the watch path makes a `.eml`
inside a `.eml` reachable from a mailbox where an attacker chooses the attachment. `depth` refuses
recursion above 1 (TM-240-09).

### SC#3 — a later reply joins the same conversation, and the Library shows a conversation ✅ **MET**

- `thread_key` derived from `References[0]` → `In-Reply-To` → `Message-ID`, **never Subject**,
  normalised and capped at 512 chars. All 14 messages of the fixture thread share one key; a reply
  ingested after the other thirteen lands on the existing key.
- **Migration 175 applied to the live local DB** (`ALTER` + `CREATE INDEX` only — no reset, dev
  data intact), `full-schema.sql` regenerated without `--reset`.
- **Written by BOTH ingest paths**, and the fence was driven RED **once per path**: deleting the
  write from the legacy path failed naming it, and deleting it from the queue path failed naming
  that one.
- **READ by two things**, because a column read by nothing is this phase's own predicted failure:
  a promoted typed view filter (all three legs — compiler, resolver whitelist, and the
  defense-in-depth re-check Phase 237 had to close), and a **Conversation section** in the shipped
  detail panel.

### SC#4 — Phase 234's promises hold for mail ⚠ **INHERITED BY CONSTRUCTION, NOT DRIVEN**

`backend/app/services/watch_service.py` closes **byte-unchanged** —
`00de61cf57a7b96f0654f02416977bcd`, before and after. Mail rides the generic sync loop, so
deletion-does-not-delete, `SourceListing.complete`'s fail-closed H-5 guard, `VIS-04` unauthorized
handling and connection-scoped visibility are inherited rather than re-implemented. A disabled
connection is refused at `SourceRegistry.get_adapter` before any mail call, and there is a test.

⛔ **Inherited is not the same as proven, and this criterion is NOT claimed as met.** No mail watch
has been created against a real mailbox. The four behaviours are in the owed list below.

---

## Gates

| Gate | Result |
|---|---|
| Backend unit (base `50f66ec39`) | `71 failed / 4260 passed / 2 xfailed / 2 xpassed` |
| Backend unit (final) | **`71 failed / 4331 passed / 2 xfailed / 2 xpassed`** |
| Failing **NAME SET** diff (`comm -13`) | **empty — zero new**, `+71` passing |
| Vitest count gate | **`count gate OK` — total 7914 · pinned total 7149 · 247/247 · 0 failing** |
| `tsc -p tsconfig.app.json --noEmit` | 67 errors, **zero new** (set diff, line-agnostic) |
| Hot-file ledger | **`ledger gate OK` — every watched file has a row** (245 rows) |
| CLAUDE.md size | OK — 87,713 chars, headroom 62,287 |
| G-7 | clear — 0 gap-closure plans |
| G-8 | 4 plans, target 3–5 |

⚠ **The count gate was RED at this phase's baseline**, on a tree whose frontend diff was **empty**:
8 failing plus two suites reported `[missing-file]`. See the owed/observations section.

⚠ **The tsc baseline had to be re-derived line-agnostically.** My first baseline keyed on
`file(line,col)`, so a 3-line edit to the api barrel made two untouched pre-existing errors read
as "new". Comparing `file + code + message` is the correct method; the first one was mine, and it
would have manufactured a finding.

---

## What existing fences caught that I did not

⭐ **Three of this phase's defects were found by guards, not by me.** Recording them is the point:

1. **`CR01.reset.test.tsx`** — my `setConvoTotal` was missing from the panel's `doc.id` reset
   block. A collapsed `PanelSection` never remounts, so a conversation badge from document A would
   have persisted on document B. The fence fired by name.
2. **`DocumentDetailPanel.a11y.test.tsx`** — an earlier draft mounted the conversation section
   TWICE (once visibly, once inside a `hidden` div) so the panel could learn the total before
   deciding whether to show the section. The always-mounted loading state is `role="status"`, and
   the suite asserts no status receipt exists before a PATCH. **Two mounts to avoid one empty
   accordion was the wrong trade**, and the shipped Relationships pattern already had the answer.
3. **My own positive control** in `ConnectedSourceSection.test.tsx` — the fixture used
   `display_name` where the component reads `name`, so **every negative assertion was passing
   vacuously**: nothing rendered, therefore nothing was "not offered". The positive control is the
   first case in that file for exactly this reason.

⚠ And one fence of mine was **blind on its first writing**: `test_the_sibling_query_is_user_scoped`
asserted `'"user_id"' in body`, and deleting `.eq("user_id", owner_id)` left it GREEN, because
`owner_id = parent.get("user_id")` two lines above still contained the string. **A fence a
neighbouring line can satisfy is not a fence.** It now matches the filter and fires by name.

---

## Ledger findings — two orphaned children of two G-5 discharges

⭐ **`backend/app/services/ingest_splice.py` FIRES G-5 at 4 phases and had NO ROW.** The file
exists *because* Phase 229 discharged G-5 on `api/documents.py` by extracting into it — **the
extraction created a new hot file that inherited no row**, so the discharge moved the code out of
the guardrail's sight. The ledger mentions the path four times, purely as the *destination* of that
extraction, which is exactly how it read as covered while being invisible.

⭐ **`frontend/src/lib/api/documents.ts` had no row either**, from the Phase 207 `lib/api.ts` split
— and its sibling `api/workflows.ts` already carries a row saying *"the 207 split created it with
NO row."* **One split, at least two orphans.** Two independent instances make this systematic:
**a refactor that discharges G-5 must add rows for what it creates, in the same commit.**

Also added, absent for their entire lives: `email_extraction_service.py` (4/1/511),
`mail/mailbox.py`, `mail/gmail.py`, `mail/__init__.py`, `email_attachments.py`,
`DocumentConversationSection.tsx`.

---

## ⛔ OWED — everything that needs the operator, batched here as instructed

Nothing below is a failure; each is a drive that needs a person, real credentials, or a decision.

### 1. G-4 lived-experience UAT — 5 rows, none driven
Defined at scope-time (D-240-18), not post-hoc.

| # | Row | Why it needs you |
|---|---|---|
| **M-1** | Watch a real Gmail label; a message arrives by itself and reads as a document | **Run this first — it unblocks M-2 and M-3.** ⚠ The Google connection may need ONE reconnect: `gmail.readonly` was added to `default_scopes` on 2026-08-31, and a token minted before that answers `403`. The error now says so in words. |
| **M-2** | Open a watched message with an attachment; the attachment is its own document, findable from both ends | This is the queue-path fix, driven for real rather than against a mock |
| **M-3** | Search the Library for a phrase from message 1 of a long thread; **one** result, not fourteen | SC#1 at product level |
| **M-4** | Disable the Google connection; the mail watch stops **and** browse/preview refuse | ⚠ Disables a live integration |
| **M-5** | Delete a message at the source; the document is **not** deleted and the source state says what happened | ⚠ Destructive at the source — your call |

### 2. SC#4 is inherited, not driven
`watch_service.py` is byte-unchanged and the four Phase-234 promises therefore apply by
construction. **No mail watch has ever run.** `M-4` and `M-5` settle this.

### 3. The independent review that AGENTS.md §6.3 requires
`/code-review ultra` is operator-triggered and billed; I cannot launch it. **Two phases now owe a
review** — 238 and 240.

### 4. Carried forward, untouched by this phase
- Phase 238's **nine** UAT rows, all blocked on one Azure app registration.
- Phase 239's owed deletion / disconnect / visibility parity on an MCP source, and
  `BUG-260902-06`'s two-worker confirmation (this dev backend runs ONE worker).
- `ConnectionShapeFields.tsx`'s G-5 seam.
- `sourceComposition.test.tsx` — measured **16 failed / 33 passed** identically WITH and WITHOUT
  this phase's changes, so it is untouched inherited red. ⚠ CLAUDE.md records it at `18 / 31` as of
  2026-09-08; today it measures `16 / 33`. **A standing-red figure that rots is how an inherited
  red gets mistaken for a new one.**

### 5. Observation, not a task — SEED-171 gained a seventh suite
`src/pages/__tests__/LibraryPage.test.tsx` produced **7 failed**, then **1 failed** in isolation
(a 5,000 ms timeout), then **0 failed**, across three runs on a tree whose frontend diff was
**empty**. The cap was NOT touched — this seed's own standing instruction, and Phase 195 measured
that adjusting it does not fix these. Filenames were captured from the gate's persisted JSON before
any re-run and each was checked against `git diff --numstat`. **Provably unmodified, never "fine".**

### 6. Deferred with a named trigger
**`SEED-260`** — Microsoft Graph mail. Needs the `Mail.Read` scope (a re-consent) and an Azure app
registration that does not exist here. ⛔ Declined deliberately: Phase 238's own verification says
its Graph download *"is asserted against a fake … the fake is mine, so it agrees with my adapter by
construction."* **Absent code is honest; untestable code that looks tested is not.**

---

## Closed in this phase

**`BUG-260908-02`** — a disabled connection offered as a Library source. Fixed in
`sourceCapability.ts` (one predicate, both surfaces), with the **first test suites either picker
component has ever had** — which is the root cause the report itself names. Re-planting the bug
reds **6 of the 10 new cases**, including one nobody had reported: `CreateWatchModal` pre-selects
`capable[0]`, so a switched-off connection would have been chosen FOR the person the instant the
modal opened. ⚠ The server-side refusal stays — a UI filter is not a security control.

---

# ⛔ ADDENDUM 2026-09-09 — THE OPERATOR DROVE IT, AND SC#3's WATCH HALF IS REFUTED

The operator ran the UAT while I was unattended and reported: browsing worked, **manual ingest of
a mail label worked**, and a watch on a label **synced nothing**. I drove it and the report is
correct. This addendum supersedes nothing above except the tone of §"SC#4 inherited": the problem
turns out to be upstream of SC#4.

## What was measured, in order

| Step | Finding |
|---|---|
| The watch row | correct — `source_folder_id = mailbox:INBOX`, `is_active`, claimed and re-claimed by the loop |
| `connector_sync_runs` for it | **zero rows**, ever |
| `connector_watch_items` | **0**, after 7+ minutes of `last_status = running` |
| The adapter, driven directly against the live account | ✅ **25 real messages with real subjects** |
| `WatchService.sync_watch()` run in-process | **still running at 360 s**, 0 items |
| Pagination, measured | 15 pages × 25 = 375 messages in **194 s**, still `next_page_token` |
| The INBOX's true size | ⛔ **at least 30,000 messages** |

## The root cause, stated plainly

**A mailbox is not a folder, and I made it wear a folder's contract.**

`watch_service`'s H-5 listing loop is EXHAUSTIVE by design — correct for a bounded folder, where
Drive returns 100 files *with their metadata* in one request. Gmail returns **25 ids** per request
and then charges **one request per message** for the subject. So:

- a 25-message page cost **23.4 s**;
- an exhaustive listing of a 30,000-message inbox is **~100 minutes**, and `max_pages = 200` caps
  it at 5,000 messages ≈ 17 minutes;
- **the watch lease is 600 s.**

So the watch was claimed, ground through the listing, lost its lease, was re-claimed, and
**restarted from page 1 — forever, ingesting nothing.** From outside: *"I clicked Sync now and
nothing happened."* Exactly what the operator saw.

⚠ **This was invisible to every test I wrote**, because each one lists a handful of messages. The
cost model was never the thing under test — and the phase's own SC#4 evidence (`watch_service.py`
byte-unchanged) is precisely what let a mismatch hide: *nothing changed, so nothing looked wrong.*

## What I fixed, and what it did not fix

⭐ **Metadata now goes through Gmail's `batch/gmail/v1`** — a page costs **2 requests instead of
26**. Measured: **375 messages 194 s → 78 s**, real subjects preserved. The test now pins the
REQUEST COUNT (`<= 3` per page), not the mechanism, because the count is the defect.

⚠ **Concurrency was tried first and MEASURED INSUFFICIENT** — 8 / 16 / 25 requests in flight gave
14.2 / 13.2 / 11.8 s per page, because the cost is per-request (each pinned call resolves and
handshakes its own connection). Recorded because it is the obvious fix and it is the wrong one.

⚠ **429 arrived on the very first live batch run** and is expected: a 50-message batch spends
Gmail's entire 250-unit/second budget at once. Rate-limited members are re-read slowly; after
bounded retries the call still RAISES, so fail-closed is preserved and no deletion signal is ever
derived from a short read.

⛔ **IT IS STILL NOT ENOUGH.** ~5 s/page × 1,200 pages ≈ **100 minutes** against a **600 s** lease.
Batching bought 2.5× where roughly 10× was needed, and no amount of tuning closes that.

## What I did NOT decide, and why it is yours

**How much of a mailbox does "watch this label" mean?** Nobody wants a 30,000-message archive in
their knowledge base for ticking a box, and I will not choose that for you. The options, with the
consequence that decides between them:

| | Option | Consequence |
|---|---|---|
| **A** | **Anchor to the watch's creation date** (`q=after:<created>`) — only mail arriving from now on | ⭐ My recommendation. The set only GROWS, so nothing ever ages out of the window and the exhaustive-completeness contract stays honest. Matches what "start watching" normally means. |
| **B** | Cap at the N most recent messages | ⛔ Older mail ages OUT of the window and would look deleted-at-source. Only safe if the listing also reports itself incomplete, which suppresses the whole deletion signal. |
| **C** | Let it run for hours across many leases | Needs resumable listing and a much longer lease. Real work, and it imports 30,000 emails nobody asked for. |

⚠ **B and C both touch `watch_service.py`**, which fires G-5 and is currently the evidence for SC#4.
**A does not** — it is a query the mail adapter adds for itself.

## State I left behind

⛔ **The mail watch is PAUSED** (`is_active = false`, `last_status = 'paused'`, with the reason in
`last_error`). It was burning Gmail quota in an infinite restart loop with you away. **Re-enable
with `is_active = true` once the decision above is made.** Your **Drive watch was not touched** and
still reads `success`.

## What this changes about the phase's claims

- **SC#1** ✅ unchanged — measured, and independent of the watch.
- **SC#2** ✅ the code is right and the fourth two-paths disagreement is genuinely closed, but it is
  **still unproven end-to-end**, because no watch has ever delivered a message.
- **SC#3** ⚠ **half met.** `thread_key` is real in production — two of the operator's manually
  ingested emails carry one — and the Conversation section reads it. The *watch* half is unproven.
- **SC#4** ⛔ unchanged and now clearly blocked behind the decision above.

⭐ **The one genuinely good piece of news from the drive:** the operator's manual ingest of a mail
label WORKED, and `thread_key` is populated on real mail in their Library. The shape, the parser
and the column are right. What is wrong is the traversal cost, and that is one decision away.

---

## ✅ CONFIRMED BY THE OPERATOR 2026-09-09 — the product marks render

The Gmail and Drive marks now draw on the Watched Folders rows, confirmed on screen by the
operator. `da95d3658` closed it.

⚠ **RECORDED BECAUSE OF HOW IT WAS FOUND, NOT BECAUSE IT WORKS.** I declared this feature done
twice while it was drawing a neutral plug:

1. First I blamed **stale HMR** and told the operator to hard-refresh. That was a guess, and it
   was wrong.
2. Then I read the source, saw `"google-gmail"` sitting in a marks table, and concluded the code
   was right. It was not: `connectionMark` has **two** lookup tables in one module — one keyed by
   CAPABILITY (`gmail_read`), one by SERVICE ID (`google-gmail`) — and I passed the service id to
   the capability arm, which answers `unknown`.

**A single render test resolved it in one run** (`VIA capability gmail_read: unknown` /
`VIA service_id google-gmail: google-gmail`), after two rounds of reasoning had not.

⭐ **The transferable lesson, and it is this phase's second instance of it:** when a value is
correct and the SCREEN is wrong, the defect is in a hop nobody tested. The original suite asserted
the key this module RETURNS; it never asserted that the key RESOLVES to a mark. It now pins the
end of the chain — a returned key must resolve to a real mark and never to the neutral plug.

⚠ Both times the operator found it by looking, after I had said it was fixed.

---

# ✅ ADDENDUM 2026-09-09 (late) — ALL FOUR CRITERIA NOW DRIVEN, M-1..M-5 COMPLETE

⚠ **NOTHING ABOVE IS EDITED.** Every claim in this file was true when written; the ADDENDUM above
recorded SC#2 as *"still unproven end-to-end"*, SC#3 as *"half met"* and SC#4 as *"inherited, not
driven"*, and all three were correct at the time. **They are superseded here rather than
overwritten**, because this file's own repeated finding is that a figure written at one moment
goes stale at the next — and a verification doc that quietly rewrites itself cannot be audited.

## What changed the verdicts

The operator drove UAT rows **M-1 through M-5** against their real Google account across the
evening, while I read the database after each. **Seven defects were found by doing so**, four of
them invisible to a suite of 25 passing unit tests.

| Row | Verdict | Evidence |
|---|---|---|
| **M-1** watch a real Gmail label | ✅ | 11 messages in 76 s, `listing_complete: true` |
| **M-2** a watched attachment becomes its own document | ✅ | `pgmp exam content outline.pdf` → **50 chunks**, in the watch's folder, `attached_to` written |
| **M-3** a long thread returns ONE hit | ✅ | measured on the stripper: 3 reply dialects stripped (⚠ forwards are NOT — `SEED-263`) |
| **M-4** disable the connection | ✅ | refused in **19 ms**, `failure_cause: connection_disabled`; **62 documents and 6,112 chunks survived** |
| **M-5** delete a message at source | ✅ | `count_missing: 1`, `listing_complete: true`, document **`completed` with `source_state: missing_at_source`**, chunk still searchable |

## SC#2 ⭐ NOW MET — and it took three live runs, each finding a different defect

The claim *"attachments arrive on both paths"* was true in code and false in practice, three times
over. Each failure hid the next:

1. **the storage upload timed out** at exactly `storage3`'s 20 s default — cause measured as GIL
   contention (0.23 s idle → 7.27 s under 16 CPU threads → **21.07 s under 32**), after
   shared-client concurrency and stale keep-alive were both measured FALSE;
2. **the child was minted with `folder_id = NULL`** — it existed, was linked, and sat nowhere;
3. **`extract_text` has not handled PDF or DOCX since Phase 069**, so every PDF attachment fell to
   its final `raw.decode("utf-8")` and died on the first non-ASCII byte.

⛔ **Only the third run proved SC#2**, and only because the first two failures were fixed in order.
**Two defects were hiding behind one another** — the timeout meant extraction was never reached.

## SC#4 ⭐ NOW MET — driven, no longer inherited

The section above says *"inherited is not the same as proven, and this criterion is NOT claimed as
met."* It is claimed now, on M-4 and M-5:

- **deletion does not delete** — the document survived at `completed`, marked `missing_at_source`,
  its chunk still searchable, its attachment untouched, and **exactly one of five items changed**;
- **H-5 held honestly** — the missing transition fired only with `listing_complete: true`;
- **a disabled connection is refused before any mail call** — 19 ms, no partial work, and the
  Library's 62 documents were still there afterwards.

## ⛔ SEVEN DEFECTS FOUND BY DRIVING, AND THE COUNT IS THE POINT

Five are filed as reported-bugs (`BUG-260909-03` … `BUG-260909-07`); two were fixed tonight and
are in the commits. **Four of the seven were invisible to the tests**, and the reason is uniform:
the tests exercised values, and the failures were in *hops nobody tested* — a screen that discards
its own answer, a card that reads the last run instead of the world, a button labelled as a write
that only travels.

⭐ **`BUG-260909-04` is the one to read first.** The operator reported *"I clicked sync now nothing
happened"* — and the sync had worked, in 19 milliseconds. Clicking **Sync now** collapses the whole
Watched Folders section into a loading state, so the outcome is drawn and thrown away before it can
be read. **A correct refusal looked like a dead button**, and it cost this session real time.

## What this phase still owes

- ⛔ **`OV-240-01` is only PARTLY discharged.** A `/gsd:code-review` ran tonight against an agent
  that did not shape the build, and it found **2 Critical + 8 Warning + 6 Info** — including one
  Critical (`CR-02`) in a fix written hours earlier, and one (`CR-01`) showing
  `MAX_MAIL_NESTING_DEPTH` was **unreachable**, its own test having proved a parameter rather than
  a behaviour. **All findings are closed.** ⚠ But that review was scoped to the evening's commits:
  **plans `240-01` … `240-04` remain unreviewed by anyone who did not build them**, and Phase 238
  still owes a review outright.
- Five open reported-bugs above.
- `SEED-261` (an attachment failure reaches no surface a person reads), `SEED-262` (the child rides
  beside the queue, not on it — **six two-paths disagreements, three found in one day**),
  `SEED-263` (forwards duplicate, and stripping them would be worse).
