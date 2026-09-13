# 245-02 — Summary

**Plan:** `245-02-PLAN.md` (the drive) · **Driven:** 2026-09-13 · **Driver:** claude, solo under `OV-SOLO-01`
**Base:** `008ece30b` · **Result:** SC#2 **CLOSED** · SC#1 **advanced, M-9 partial**

⛔ **This is a self-verification, not a review.** No independent §6.3 reviewer exists.

## What was done

All five of Phase 233's owed G-4 operator rows were driven in a real browser against live local
infra, plus 238's M-9 through both doors and the first-ever manual click of 237's rule-builder.
Full evidence, table by table, is in **`245-UAT-RESULTS.md`** — this file records the reasoning,
the deviations and the one thing that went differently from plan.

| row | requirement | verdict |
|---|---|---|
| 233 row 2 | DEBT-02 | ✅ PASS — driven first, scored against the DB |
| 233 row 1 | DEBT-02 | ✅ PASS |
| 233 row 3 | DEBT-02 | ✅ PASS, refusal arm owed |
| 233 row 4 | DEBT-02 | ✅ PASS |
| 233 row 5 | DEBT-02 | ✅ PASS |
| 238 M-9 | DEBT-01 | ⚠ PARTIAL — Google Drive arm failed with a traced cause; Microsoft arm owed |
| 237 rule-builder | D-14 | ⭐ clicked, covering more than predicted |

## Deviations

**`DEVIATION-245-02-A` — Claude performed D-10's operator half.** D-10 assigned the Drive-side
setup to the operator. The claude.ai Drive MCP authenticates as `fhdmrd@gmail.com`, the same
account the app's `oauth_byo` Google connection uses, so Claude created the fixture instead. **The
operator authorised this and the local-corpus writes explicitly in chat before anything ran**, and
the STOP arm and identity gate were kept regardless — approval to write is not proof the accounts
match. Fallback to the named operator action was never needed.

## The identity gate, and why it was an equality

An invisible fixture folder and a broken preview are indistinguishable, so a name match would have
been worthless. The gate was: the folder id the app reports **equals** the id `create_folder`
returned. It was satisfied by reading `folderId` off the live React props of the node the app
itself rendered — `1e-mOprqjjxp3AHa8IPE8d4QnK4hYorSP`, byte-identical.

⚠ An earlier attempt to prove this by re-issuing the app's own preview `fetch` was **blocked by a
harness guard** because the script read auth storage looking for a bearer token. That was the right
refusal and the DOM-prop route touches no credentials at all. Recorded so the next drive reaches
for the second route first.

## ⭐ The finding, and how it was nearly recorded wrong

`BUG-260913-01`: **the Google Drive adapter never writes `metadata.source.path`, on either door.**
Consequence: every path-based classification rule is silently inert for every Drive document — no
error, rule reads as enabled, matches nothing, forever.

**The first diagnosis was wrong.** After the manual-import arm produced `path: null`, and knowing
Phase 238's Defect 3 note said *"`metadata.source` had two writers; only the watch one was fixed"*,
the obvious read was *"the manual door is broken, the watch door is fine"* — and the `/INBOX` mail
documents appeared to corroborate it. A report was written saying exactly that.

**Driving the second door refuted it.** The watch arm returned `last_status: success` and also wrote
`path: null`. The corpus-wide grouping then settled it:

| source | `path` populated |
|---|---|
| Gmail | ✅ `/INBOX` ×25, `/CATEGORY_FORUMS` ×2 |
| Microsoft OneDrive | ✅ `/Attachments/…` ×2 — 238's own M-6/M-7 documents |
| Google Drive, manual door | ❌ null |
| Google Drive, watch door | ❌ null |
| Google Drive, pre-existing `CV` watch | ❌ null |

**The split is by ADAPTER, not by door.** Had only the manual arm been driven, a Drive-wide defect
would have been filed against the folder-import surface and the real cause would have gone unfound.
**D-05's insistence on both doors is the only reason the cause is right** — that decision earned its
keep, and not in the way it expected to. The superseded diagnosis is preserved inside the bug report
rather than overwritten, because how it was wrong is the transferable part.

## Why M-9 is PARTIAL and not PASS or FAIL

238 is a **Microsoft Graph** phase; M-9's own provider is OneDrive, where `path` **is** populated.
This drive exercised **Google Drive**. So the failure observed is real but is *not* M-9's failure —
it is a wider, different defect that M-9's drive happened to expose. Calling this row PASS would be
false; calling it FAIL would blame the wrong component. **PARTIAL with a named trigger is the honest
verdict**: the Microsoft arm needs a `/Finance/` folder in the OneDrive account, an operator action.

⚠ This is the same class of error the phase exists to prevent, caught in-flight: a row marked done
on evidence that does not actually address it.

## D-14 over-delivered

D-14 predicted the M-9 click would cover a single `path contains` rule and leave 237's scope
selector untouched. **The scope selector could not be avoided** — `path` is arrival-scope, so the
panel had to be switched from *After extraction* to *When files arrive*. Covered: both scope cards
and the switch, the arrival field list (`name · path · type · size · date · source_system ·
source_connection_id`), the operator list, the value input, the folder picker, save, and the
persisted `rule_scope: watch`. **Still uncovered:** out-of-scope condition filtering on scope switch,
because the rule was built scope-first and no condition ever had to be dropped. Trigger recorded.

## Defect handling

One defect found, **none fixed** — correct under D-16 (G-3's ≤ 1 file / ≤ 10 lines / no schema or
API surface). This needs an adapter change plus a cross-adapter fence. ⭐ The fix owes the **fence**
as much as the patch: the gap existed on Microsoft until 238 and on Drive since 232, so a test
asserting every adapter populates `source.path` is what stops the next adapter repeating it.

## Environment notes worth not rediscovering

- **The Chrome MCP tab wedged.** Its viewport froze at `863×390`, then `433×195`, and
  `resize_window` reported success on every call while changing nothing — the app fell back to its
  mobile layout and the nav rail became unreachable. **A fresh tab in the same group came up at a
  correct `1536×639` and fixed it instantly.** Reach for a new tab before fighting the resize.
- `Page.captureScreenshot` timed out repeatedly at 30 s while the page stayed responsive to
  `get_page_text` and `find`. A timed-out screenshot is not a hung page; re-issue it standalone.
- The app has no client router: navigating to `/app/library` by URL lands on chat. Navigation is
  in-app clicks only.

## Owed after this plan

- **M-9's Microsoft arm** — trigger: a `/Finance/` folder in the OneDrive account, or the next phase
  touching Graph ingestion.
- **233 row 3's refusal arm** — *"a refusal names its cause"* was never exercised because nothing was
  refused. Trigger: the next drive that induces one.
- **Teardown** — the Drive fixture, the Library folder and its 7 documents, the `Finance` watch and
  the M-9 rule. ⚠ Held deliberately: they are `245-UAT-RESULTS.md`'s evidence.
