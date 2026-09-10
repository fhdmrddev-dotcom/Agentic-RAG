# 240-01 — SUMMARY

**Goal:** Gmail becomes browsable from the Library without a fourth `SourceAdapter`.
**Commit:** `563ad15f5` · **Status:** complete

## What shipped
- `backend/app/services/sources/mail/` — `mailbox.py` (147 L, provider-INDEPENDENT), `gmail.py`
  (the Gmail half), `__init__.py` (re-exports only, must never import an adapter — that edge is a
  cycle that would break registration for every family).
- Three delegations in `adapters/google_drive.py`: a third virtual root, a label listing, a raw
  message read.

## Measured, not asserted
| Claim | Evidence |
|---|---|
| The contract does not change | `md5 base.py` = `3b3d8770a6c9309f0635503d155dd8f7` **before and after**; `git diff --numstat` prints nothing |
| The delegation is cheap | **+35 / −0** lines in `google_drive.py`, ~20 of them comment |
| Mail is not a fourth adapter | no registry key matches `mail|gmail|imap|outlook`; a Google connection still resolves to `GoogleDriveSourceAdapter` |
| The shape half is really provider-blind | `mailbox.py` added to `test_boundary_fence.py`'s `FENCED_MODULES` — mechanical, not a promise |

## The fence was driven RED three ways
1. Planted `SourceFile.thread_id` → failed by field-name.
2. Planted registry key `gmail` → failed by key-name.
3. Planted the word `gmail` in `base.py` → failed by word.
`base.py` restored and proven identical by md5.

⚠ **The FIRST plant for case 2 did not fire.** I planted a `PROTOCOL_ADAPTERS` row, which is not a
registry key — the test was right and the plant was wrong. Recorded because *"I drove it red"* is
worthless unless the plant is the thing the fence claims to catch.

## Two existing pins were updated, and made STRONGER
`test_google_drive_adapter.py` and `test_source_adapter_conformance.py` asserted the root count was
`2`. The roots genuinely became three, so both were rewritten as **id sets / ordered id lists** —
a fourth root now fails by NAME rather than by arithmetic. ⚠ This is a deliberate change to a pin
whose subject changed; it is not the same as editing a pin to hide a regression.

## Conformance
Mail joined the shared contract as a second FIXTURE on an existing adapter (`mail_gmail`), not a
new class — an asymmetry noted in the file, because every other entry names a distinct class.
`tests/unit/services/sources/` 311 → 315 passing.

## Owed
Nothing from this plan. The live drive is `M-1` in `240-VERIFICATION.md`.
