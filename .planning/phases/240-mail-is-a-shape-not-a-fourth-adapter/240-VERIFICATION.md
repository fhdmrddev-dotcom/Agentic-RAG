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
